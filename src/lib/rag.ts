/**
 * RAG (Retrieval-Augmented Generation) utilities
 *
 * Pipeline :
 *  1. extractTextViaGemini  — extrait le texte brut d'un fichier via l'API Gemini
 *  2. chunkText             — découpe le texte en segments avec overlap
 *  3. generateEmbedding     — vectorise un texte avec text-embedding-004 (768 dims)
 *  4. findRelevantChunks    — similarité cosinus en mémoire → top-N chunks
 */

import { GoogleGenAI } from "@google/genai";
import { prisma as prismaInstance } from "@/src/lib/prisma";

// Type du singleton Prisma (compatible avec le driver adapter de Prisma 7)
type PrismaInstance = typeof prismaInstance;

// ─── Paramètres ───────────────────────────────────────────────────────────────

const CHUNK_SIZE    = 900;   // caractères par chunk
const CHUNK_OVERLAP = 150;   // overlap entre deux chunks consécutifs
const MIN_CHUNK_LEN = 80;    // chunk trop court = ignoré
const EMBED_MODEL   = "gemini-embedding-001"; // NOUVEAU MODÈLE GOOGLE ACTIF
const EXTRACT_MODEL = "gemini-2.5-flash";

// ─── Chunking ─────────────────────────────────────────────────────────────────

/**
 * Découpe un texte brut en chunks de taille fixe avec overlap.
 */
export function chunkText(text: string): string[] {
  const clean  = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    const end   = Math.min(start + CHUNK_SIZE, clean.length);
    const chunk = clean.slice(start, end).trim();
    if (chunk.length >= MIN_CHUNK_LEN) chunks.push(chunk);
    if (end >= clean.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

// ─── Sécurité API (Rate-Limiting) ─────────────────────────────────────────────

async function withRateLimitRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      const isRateLimit = e.status === 429 || e.message?.includes("exceeded") || e.message?.includes("Quota");
      if (attempt >= retries || (!isRateLimit && e.status !== 503)) {
        throw e;
      }
      attempt++;
      console.warn(`[RAG] ⚠️ Quota ou 503 atteint. Pause de 22s avant retry ${attempt}/${retries}...`);
      await new Promise(r => setTimeout(r, 22000));
    }
  }
}

// ─── Extraction de texte ──────────────────────────────────────────────────────

/**
 * Extrait le texte brut d'un fichier déjà uploadé sur Gemini File API.
 * Coût : une seule requête Flash (une fois à l'upload, pas à chaque génération).
 */
export async function extractTextViaGemini(
  ai: GoogleGenAI,
  fileUri: string,
  mimeType: string
): Promise<string> {
  const response = await withRateLimitRetry(() => ai.models.generateContent({
    model: EXTRACT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { fileData: { fileUri, mimeType } },
          {
            text:
              "Extrais intégralement le texte de ce document. " +
              "Retourne uniquement le texte brut, sans mise en forme, " +
              "sans commentaire, sans introduction ni conclusion.",
          },
        ],
      },
    ],
  }));
  return response.text ?? "";
}

// ─── Embeddings ───────────────────────────────────────────────────────────────

/**
 * Génère un vecteur d'embedding (768 dimensions) pour un texte donné.
 */
export async function generateEmbedding(
  ai: GoogleGenAI,
  text: string
): Promise<number[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await withRateLimitRetry(() => (ai.models as any).embedContent({
    model: EMBED_MODEL,
    contents: text,
  }));

  // Le SDK @google/genai peut retourner embeddings[] ou embedding selon la version
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any;
  return r?.embeddings?.[0]?.values ?? r?.embedding?.values ?? [];
}

/**
 * Génère des embeddings en parallèle pour un tableau de textes.
 * Limite à 10 requêtes simultanées pour éviter le rate-limiting.
 */
export async function generateEmbeddingsBatch(
  ai: GoogleGenAI,
  texts: string[]
): Promise<number[][]> {
  const BATCH = 5;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const embeddings = await Promise.all(
      slice.map((t) => generateEmbedding(ai, t))
    );
    results.push(...embeddings);
    // Délai systématique pour éviter le rate-limit global des embeddings
    await new Promise(r => setTimeout(r, 1000));
  }

  return results;
}

// ─── Similarité cosinus ───────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Recherche sémantique ─────────────────────────────────────────────────────

export interface RelevantChunk {
  content:  string;
  category: string;
  source:   string;
  score:    number;
}

/**
 * Charge tous les chunks pertinents (plateforme + universels) depuis la DB,
 * calcule la similarité cosinus avec le vecteur de requête, et retourne top-N.
 */
export async function findRelevantChunks(
  prisma: PrismaInstance,
  queryEmbedding: number[],
  platform: string,
  topN = 8
): Promise<RelevantChunk[]> {
  const chunks = await prisma.documentChunk.findMany({
    where: {
      OR: [{ platform }, { platform: null }],
    },
    select: {
      content:   true,
      embedding: true,
      category:  true,
      source:    true,
    },
  });

  return chunks
    .map((c) => ({
      content:  c.content,
      category: c.category,
      source:   c.source,
      score:    cosineSimilarity(queryEmbedding, c.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// ─── Indexation d'un document ─────────────────────────────────────────────────

/**
 * Extrait, découpe et vectorise un document Gemini File API,
 * puis stocke les chunks dans la DB.
 * Appelé automatiquement lors de l'upload admin.
 */
export async function indexDocument(
  ai: GoogleGenAI,
  prisma: PrismaInstance,
  params: {
    documentId: string | null; // null pour les fichiers locaux
    fileUri:    string;
    mimeType:   string;
    category:   string;
    platform:   string | null;
    source?:    string;        // ex: "local:wordpress/tuto.pdf"
    rawText?:   string;        // texte déjà extrait (ex: markdown)
  }
): Promise<number> {
  // 1. Extraction du texte (ou utilisation du texte fourni)
  const rawText = params.rawText ?? await extractTextViaGemini(ai, params.fileUri, params.mimeType);
  if (!rawText.trim()) return 0;

  // 2. Chunking
  const chunks = chunkText(rawText);
  if (chunks.length === 0) return 0;

  // 3. Embeddings en batch
  const embeddings = await generateEmbeddingsBatch(ai, chunks);

  const source = params.source ?? (params.documentId ? `db:${params.documentId}` : "local:unknown");

  // 4. Suppression des anciens chunks pour cette source (re-indexation propre)
  if (params.documentId) {
    await prisma.documentChunk.deleteMany({ where: { documentId: params.documentId } });
  } else {
    await prisma.documentChunk.deleteMany({ where: { source } });
  }

  // 5. Insertion en DB
  await prisma.documentChunk.createMany({
    data: chunks.map((content, i) => ({
      content,
      embedding:  embeddings[i],
      chunkIndex: i,
      source,
      category:   params.category,
      platform:   params.platform,
      documentId: params.documentId,
    })),
  });

  // 6. Marquer le document comme indexé (uniquement pour les docs DB)
  if (params.documentId) {
    await prisma.knowledgeDocument.update({
      where: { id: params.documentId },
      data:  { indexed: true },
    });
  }

  return chunks.length;
}
