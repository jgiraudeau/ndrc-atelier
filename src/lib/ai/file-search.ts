import fs from "fs/promises";
import os from "os";
import path from "path";
import type {
  CustomMetadata,
  Document,
  FileSearchStore,
  Operation,
  UploadToFileSearchStoreOperation,
  UploadToFileSearchStoreResponse,
} from "@google/genai";
import { getGenAI, getGeminiDeveloperApiClient } from "@/src/lib/rag";

const GLOBAL_STORE_DISPLAY_NAME =
  process.env.RAG_GLOBAL_STORE_NAME?.trim() || "ndrc-rag-global-knowledge";
const KNOWLEDGE_CANDIDATE_DIR_NAMES = ["knowledge", "knoweldge"] as const;
const KNOWLEDGE_DEFAULT_DIR = path.join(
  process.cwd(),
  KNOWLEDGE_CANDIDATE_DIR_NAMES[0]
);
const KNOWLEDGE_ENV_DIR = process.env.RAG_KNOWLEDGE_DIR?.trim() || null;
const KNOWLEDGE_SOURCE_TYPE = "knowledge_folder";
const KNOWLEDGE_DOC_PREFIX = "knowledge-doc-";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 600000;
const API_REQUEST_TIMEOUT_MS = 180000;
const FILE_SEARCH_LIST_PAGE_SIZE = 20;
const FILE_SYNC_MAX_ATTEMPTS = 3;
const FILE_SYNC_RETRY_DELAY_MS = 2500;

const KNOWLEDGE_ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".rtf",
  ".odt",
  ".ods",
  ".odp",
]);

type UploadOperation =
  | UploadToFileSearchStoreOperation
  | Operation<UploadToFileSearchStoreResponse>;

type ListedStoreDocument = {
  name: string;
  displayName: string;
  mimeType: string | null;
  state: string | null;
  sizeBytes: number | null;
  createTime: string | null;
  updateTime: string | null;
  sourceType: string | null;
  sourcePath: string | null;
};

export type KnowledgeSyncResult = {
  storeName: string;
  folderPath: string;
  discovered: number;
  indexed: number;
  skipped: number;
  removed: number;
  failed: number;
  errors: string[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function getFileSearchClient() {
  try {
    return getGeminiDeveloperApiClient();
  } catch {
    return getGenAI();
  }
}

function assertFileSearchSdkAvailability() {
  const client = getFileSearchClient();
  if (!client.fileSearchStores || !client.fileSearchStores.documents || !client.operations) {
    throw new Error(
      "File Search SDK indisponible pour cette configuration (vérifiez @google/genai et le mode d'authentification)."
    );
  }
}

function safeToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function knowledgeDocDisplayName(relativePath: string, mtimeMs: number): string {
  const pathToken = safeToken(relativePath.replace(/[\\/]/g, "__"));
  return `${KNOWLEDGE_DOC_PREFIX}${Math.trunc(mtimeMs)}-${pathToken}`.slice(0, 120);
}

function safeBaseName(fileName: string): string {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function inferKnowledgeMimeType(filePath: string): string | undefined {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    case ".csv":
      return "text/csv";
    case ".json":
      return "application/json";
    case ".xml":
      return "application/xml";
    case ".html":
    case ".htm":
      return "text/html";
    case ".pdf":
      return "application/pdf";
    case ".rtf":
      return "application/rtf";
    default:
      return undefined;
  }
}

function isRetriableSyncError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("internal error encountered") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("temporar") ||
    message.includes("unavailable") ||
    message.includes("503") ||
    message.includes("429")
  );
}

async function retrySyncOperation<T>(
  operation: () => Promise<T>,
  label: string,
  maxAttempts = FILE_SYNC_MAX_ATTEMPTS
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const canRetry = attempt < maxAttempts && isRetriableSyncError(err);
      if (!canRetry) break;
      await sleep(FILE_SYNC_RETRY_DELAY_MS * attempt);
    }
  }

  if (lastError instanceof Error) {
    throw new Error(`${label}: ${lastError.message}`);
  }
  throw new Error(`${label}: unknown error`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOperationErrorMessage(error: Record<string, unknown> | undefined): string | null {
  if (!error) return null;

  const directMessage = error.message;
  if (typeof directMessage === "string" && directMessage.trim().length > 0) {
    return directMessage;
  }

  const details = error.details;
  if (!Array.isArray(details)) return null;

  for (const detail of details) {
    if (!isRecord(detail)) continue;
    const detailMessage = detail.message;
    if (typeof detailMessage === "string" && detailMessage.trim().length > 0) {
      return detailMessage;
    }
  }

  return null;
}

function readMetadataString(doc: Document, key: string): string | null {
  const metadata = doc.customMetadata ?? [];
  for (const item of metadata) {
    if (item.key !== key) continue;
    if (typeof item.stringValue === "string" && item.stringValue.length > 0) {
      return item.stringValue;
    }
  }
  return null;
}

function mapDocumentForList(doc: Document): ListedStoreDocument {
  const sizeCandidate = doc.sizeBytes ? Number(doc.sizeBytes) : null;
  const sizeBytes = sizeCandidate !== null && Number.isFinite(sizeCandidate) ? sizeCandidate : null;

  return {
    name: doc.name || "",
    displayName: doc.displayName || "",
    mimeType: doc.mimeType || null,
    state: doc.state || null,
    sizeBytes,
    createTime: doc.createTime || null,
    updateTime: doc.updateTime || null,
    sourceType: readMetadataString(doc, "source_type"),
    sourcePath: readMetadataString(doc, "source_path"),
  };
}

async function waitForOperation(initialOperation: UploadOperation): Promise<UploadOperation> {
  const client = getFileSearchClient();
  let operation: UploadOperation = initialOperation;
  const startedAt = Date.now();

  while (!operation.done) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error("File Search indexing timeout");
    }

    await sleep(POLL_INTERVAL_MS);
    operation = await withTimeout(
      client.operations.get({ operation }),
      API_REQUEST_TIMEOUT_MS,
      "File Search operation poll"
    );
  }

  const errorMessage = readOperationErrorMessage(operation.error);
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return operation;
}

function extractDocumentNameFromOperation(operation: UploadOperation): string | null {
  return operation.response?.documentName ?? null;
}

async function listAllStores(): Promise<FileSearchStore[]> {
  assertFileSearchSdkAvailability();
  const client = getFileSearchClient();
  const storesPager = await client.fileSearchStores.list();
  const stores: FileSearchStore[] = [];
  for await (const store of storesPager) stores.push(store);
  return stores;
}

async function ensureStoreByDisplayName(displayName: string): Promise<string> {
  assertFileSearchSdkAvailability();
  const client = getFileSearchClient();
  const stores = await listAllStores();
  const existing = stores.find((store) => store.displayName === displayName);

  if (existing?.name) {
    return existing.name;
  }

  const created = await client.fileSearchStores.create({
    config: { displayName },
  });

  if (!created.name) {
    throw new Error("Unable to create File Search store");
  }

  return created.name;
}

export async function ensureGlobalFileSearchStore(): Promise<string> {
  return ensureStoreByDisplayName(GLOBAL_STORE_DISPLAY_NAME.slice(0, 120));
}

async function listStoreDocuments(storeName: string): Promise<Document[]> {
  assertFileSearchSdkAvailability();
  const client = getFileSearchClient();
  const docsPager = await client.fileSearchStores.documents.list({
    parent: storeName,
    config: { pageSize: FILE_SEARCH_LIST_PAGE_SIZE },
  });

  const documents: Document[] = [];
  for await (const doc of docsPager) documents.push(doc);
  return documents;
}

async function uploadPathToStore(params: {
  storeName: string;
  filePath: string;
  displayName: string;
  mimeType?: string;
  customMetadata?: CustomMetadata[];
}): Promise<{ operation: UploadOperation; documentName: string | null }> {
  assertFileSearchSdkAvailability();
  const client = getFileSearchClient();
  const { storeName, filePath, displayName, mimeType, customMetadata } = params;

  let operation = await withTimeout(
    client.fileSearchStores.uploadToFileSearchStore({
      file: filePath,
      fileSearchStoreName: storeName,
      config: {
        displayName,
        ...(mimeType ? { mimeType } : {}),
        ...(customMetadata?.length ? { customMetadata } : {}),
      },
    }),
    API_REQUEST_TIMEOUT_MS,
    "File Search upload request"
  );

  operation = await waitForOperation(operation);
  const documentName = extractDocumentNameFromOperation(operation);
  return { operation, documentName };
}

async function withTempCopyOfFile<T>(
  sourcePath: string,
  callback: (filePath: string) => Promise<T>
): Promise<T> {
  const tmpName = `rag-${Date.now()}-${Math.random().toString(36).slice(2)}-${safeBaseName(
    path.basename(sourcePath)
  )}`;
  const filePath = path.join(os.tmpdir(), tmpName);

  await fs.copyFile(sourcePath, filePath);
  try {
    return await callback(filePath);
  } finally {
    await fs.unlink(filePath).catch(() => undefined);
  }
}

async function collectKnowledgeFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (/^readme(\..+)?$/i.test(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      if (entry.name.startsWith("~$")) continue;

      const extension = path.extname(entry.name).toLowerCase();
      if (!KNOWLEDGE_ALLOWED_EXTENSIONS.has(extension)) continue;

      files.push(absolutePath);
    }
  }

  await walk(rootDir);
  return files;
}

async function resolveKnowledgeRoot(folderPath?: string): Promise<string> {
  if (folderPath && folderPath.trim().length > 0) {
    return path.resolve(folderPath.trim());
  }

  if (KNOWLEDGE_ENV_DIR) {
    return path.resolve(KNOWLEDGE_ENV_DIR);
  }

  for (const dirName of KNOWLEDGE_CANDIDATE_DIR_NAMES) {
    const candidate = path.join(process.cwd(), dirName);
    const stats = await fs.stat(candidate).catch(() => null);
    if (stats?.isDirectory()) return candidate;
  }

  return KNOWLEDGE_DEFAULT_DIR;
}

export async function syncKnowledgeFolderToGlobalStore(params?: {
  folderPath?: string;
  removeMissing?: boolean;
}): Promise<KnowledgeSyncResult> {
  const resolvedFolder = await resolveKnowledgeRoot(params?.folderPath);
  const removeMissing = params?.removeMissing ?? true;

  const folderStats = await fs.stat(resolvedFolder).catch(() => null);
  if (!folderStats?.isDirectory()) {
    throw new Error(
      `Dossier de knowledge introuvable: ${resolvedFolder}. Attendu: 'knowledge' (ou 'knoweldge').`
    );
  }

  const storeName = await ensureGlobalFileSearchStore();
  const existingDocs = await listStoreDocuments(storeName);
  const existingDisplayNames = new Set<string>();
  const knowledgeDocsByPath = new Map<string, Document[]>();

  for (const doc of existingDocs) {
    if (doc.displayName) existingDisplayNames.add(doc.displayName);

    const sourceType = readMetadataString(doc, "source_type");
    const sourcePath = readMetadataString(doc, "source_path");
    if (sourceType !== KNOWLEDGE_SOURCE_TYPE || !sourcePath) continue;

    const bucket = knowledgeDocsByPath.get(sourcePath) || [];
    bucket.push(doc);
    knowledgeDocsByPath.set(sourcePath, bucket);
  }

  const files = await collectKnowledgeFiles(resolvedFolder);
  const currentSourcePaths = new Set<string>();
  const result: KnowledgeSyncResult = {
    storeName,
    folderPath: resolvedFolder,
    discovered: files.length,
    indexed: 0,
    skipped: 0,
    removed: 0,
    failed: 0,
    errors: [],
  };

  for (const absolutePath of files) {
    const relativePath = path.relative(resolvedFolder, absolutePath).replace(/\\/g, "/");
    currentSourcePaths.add(relativePath);

    const fileStats = await fs.stat(absolutePath);
    const displayName = knowledgeDocDisplayName(relativePath, fileStats.mtimeMs);

    try {
      const previousVersions = knowledgeDocsByPath.get(relativePath) || [];
      const hasCurrentVersion = previousVersions.some(
        (doc) => doc.displayName && doc.displayName === displayName
      );
      const staleVersions = previousVersions.filter(
        (doc) => !doc.displayName || doc.displayName !== displayName
      );

      for (const oldDoc of staleVersions) {
        if (!oldDoc.name) continue;
        await retrySyncOperation(
          () => deleteStoreDocument(oldDoc.name!),
          `delete stale ${relativePath}`
        );
        if (oldDoc.displayName) existingDisplayNames.delete(oldDoc.displayName);
        result.removed++;
      }

      knowledgeDocsByPath.delete(relativePath);

      if (hasCurrentVersion || existingDisplayNames.has(displayName)) {
        result.skipped++;
        continue;
      }

      await retrySyncOperation(
        () =>
          withTempCopyOfFile(absolutePath, async (tmpPath) => {
            await uploadPathToStore({
              storeName,
              filePath: tmpPath,
              displayName,
              mimeType: inferKnowledgeMimeType(absolutePath),
              customMetadata: [
                { key: "source_type", stringValue: KNOWLEDGE_SOURCE_TYPE },
                { key: "source_path", stringValue: relativePath },
                { key: "source_mtime", numericValue: Math.trunc(fileStats.mtimeMs) },
              ],
            });
          }),
        relativePath
      );

      result.indexed++;
      existingDisplayNames.add(displayName);
    } catch (err) {
      result.failed++;
      const msg = err instanceof Error ? err.message : "Erreur inconnue pendant l'indexation";
      result.errors.push(`${relativePath}: ${msg}`);
    }
  }

  if (removeMissing) {
    for (const [sourcePath, docs] of knowledgeDocsByPath.entries()) {
      if (currentSourcePaths.has(sourcePath)) continue;
      for (const doc of docs) {
        if (!doc.name) continue;
        try {
          await retrySyncOperation(
            () => deleteStoreDocument(doc.name!),
            `delete missing ${sourcePath}`
          );
          result.removed++;
        } catch (err) {
          result.failed++;
          const msg = err instanceof Error ? err.message : "Erreur inconnue pendant la suppression";
          result.errors.push(`cleanup ${sourcePath}: ${msg}`);
        }
      }
    }
  }

  return result;
}

export async function deleteStoreDocument(documentName: string): Promise<void> {
  assertFileSearchSdkAvailability();
  const client = getFileSearchClient();
  await client.fileSearchStores.documents.delete({
    name: documentName,
    config: { force: true },
  });
}

export async function listGlobalStoreDocuments(): Promise<{
  storeName: string;
  documents: ListedStoreDocument[];
}> {
  const storeName = await ensureGlobalFileSearchStore();
  const rawDocs = await listStoreDocuments(storeName);
  return { storeName, documents: rawDocs.map(mapDocumentForList) };
}

export async function uploadAdminFileToGlobalStore(file: File): Promise<{
  storeName: string;
  displayName: string;
  documentName: string | null;
  mimeType: string;
  sizeBytes: number;
}> {
  const storeName = await ensureGlobalFileSearchStore();
  const mimeType = file.type || "application/octet-stream";
  const displayName = `upload-${Date.now()}-${safeBaseName(file.name)}`.slice(0, 120);
  const buffer = Buffer.from(await file.arrayBuffer());

  const tmpName = `rag-${Date.now()}-${Math.random().toString(36).slice(2)}-${safeBaseName(file.name)}`;
  const filePath = path.join(os.tmpdir(), tmpName);
  await fs.writeFile(filePath, buffer);
  try {
    const result = await uploadPathToStore({
      storeName,
      filePath,
      displayName,
      mimeType: inferKnowledgeMimeType(file.name),
      customMetadata: [{ key: "source_type", stringValue: "uploaded_file_admin" }],
    });

    return {
      storeName,
      displayName,
      documentName: result.documentName,
      mimeType,
      sizeBytes: file.size,
    };
  } finally {
    await fs.unlink(filePath).catch(() => undefined);
  }
}
