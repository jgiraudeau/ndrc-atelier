/**
 * GET  /api/admin/knowledge/index-local  → liste les fichiers dans /knowledge/
 * POST /api/admin/knowledge/index-local  → indexe UN seul fichier (body: { singleFile: "local:dossier/fichier.pdf" })
 *
 * Le client appelle d'abord GET pour obtenir la liste, puis fait N appels POST
 * (un par fichier) pour traiter chaque fichier dans la limite des 10 s Vercel Hobby.
 *
 * Idempotent : les anciens chunks du fichier ciblé sont supprimés avant re-création.
 * Pour une réinitialisation complète, le premier appel POST peut inclure { purgeAll: true }.
 */
import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/src/lib/prisma";
import { indexDocument, getGenAI } from "@/src/lib/rag";
import fs from "fs";
import path from "path";

export const maxDuration = 60; // 60 s par fichier (Vercel Pro) — sur Hobby c'est capé à 10 s

// ─── Mapping dossier → catégorie / plateforme ────────────────────────────────

type FolderEntry = {
  folder:   string;
  category: string;
  platform: string | null;
  rootOnly?: boolean;
};

const FOLDER_MAP: FolderEntry[] = [
  { folder: "wordpress",         category: "COURS",       platform: "WORDPRESS"  },
  { folder: "seo",               category: "COURS",       platform: "WORDPRESS"  },
  { folder: "prestashop",        category: "COURS",       platform: "PRESTASHOP" },
  { folder: "referentiel",       category: "REFERENTIEL", platform: null         },
  { folder: "sujets/wordpress",  category: "SUJET",       platform: "WORDPRESS"  },
  { folder: "sujets/prestashop", category: "SUJET",       platform: "PRESTASHOP" },
  { folder: "sujets/e5",         category: "SUJET",       platform: null         },
  { folder: "sujets",            category: "SUJET",       platform: null,  rootOnly: true },
  { folder: "contextes",         category: "CONTEXTE",    platform: null         },
];

const SUPPORTED_MIME: Record<string, string> = {
  pdf:  "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt:  "text/plain",
  md:   "text/markdown",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMimeType(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_MIME[ext] ?? null;
}

function isTextFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ext === "md" || ext === "txt";
}

async function extractTextInline(
  ai: GoogleGenAI,
  filePath: string,
  mimeType: string
): Promise<string> {
  const base64 = fs.readFileSync(filePath).toString("base64");
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: base64, mimeType } },
          {
            text:
              "Extrais intégralement le texte de ce document. " +
              "Retourne uniquement le texte brut, sans mise en forme, " +
              "sans commentaire, sans introduction ni conclusion.",
          },
        ],
      },
    ],
  });
  return response.text ?? "";
}

// ─── Construire la liste complète des fichiers ────────────────────────────────

type FileJob = {
  source:   string;
  filename: string;
  filePath: string;
  mimeType: string;
  category: string;
  platform: string | null;
  isText:   boolean;
};

function buildFileList(knowledgeDir: string): FileJob[] {
  const jobs: FileJob[] = [];
  for (const entry of FOLDER_MAP) {
    const folderPath = path.join(knowledgeDir, entry.folder);
    if (!fs.existsSync(folderPath)) continue;
    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      if (fs.statSync(fullPath).isDirectory()) continue;
      const mimeType = getMimeType(file);
      if (!mimeType) continue;
      jobs.push({
        source:   `local:${entry.folder}/${file}`,
        filename: file,
        filePath: fullPath,
        mimeType,
        category: entry.category,
        platform: entry.platform,
        isText:   isTextFile(file),
      });
    }
  }
  return jobs;
}

// ─── GET : retourne la liste des fichiers sans les traiter ───────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ["ADMIN"]);
    if ("status" in auth && auth.status !== 200) return auth;

    const knowledgeDir = path.join(process.cwd(), "knowledge");
    if (!fs.existsSync(knowledgeDir)) {
      return apiError("Dossier /knowledge introuvable sur ce déploiement.", 404);
    }

    const jobs = buildFileList(knowledgeDir);
    return apiSuccess({
      total: jobs.length,
      files: jobs.map((j) => ({
        source:   j.source,
        filename: j.filename,
        category: j.category,
        platform: j.platform,
      })),
    });
  } catch (error: any) {
    return apiError(error.message || "Erreur.", 500);
  }
}

// ─── POST : indexe UN seul fichier ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ["ADMIN"]);
    if ("status" in auth && auth.status !== 200) return auth;

    const knowledgeDir = path.join(process.cwd(), "knowledge");
    if (!fs.existsSync(knowledgeDir)) {
      return apiError("Dossier /knowledge introuvable sur ce déploiement.", 404);
    }

    const body = await request.json().catch(() => ({}));
    const { singleFile, purgeAll } = body as { singleFile?: string; purgeAll?: boolean };

    // Purge globale en option (appelée une fois avant la boucle cliente)
    if (purgeAll) {
      const deleted = await prisma.documentChunk.deleteMany({
        where: { source: { startsWith: "local:" } },
      });
      console.log(`[index-local] purge: ${deleted.count} chunks supprimés`);
      if (!singleFile) {
        return apiSuccess({ purged: deleted.count });
      }
    }

    if (!singleFile) {
      return apiError("Paramètre singleFile requis.", 400);
    }

    // Trouver le job correspondant
    const jobs = buildFileList(knowledgeDir);
    const job  = jobs.find((j) => j.source === singleFile);
    if (!job) {
      return apiError(`Fichier introuvable : ${singleFile}`, 404);
    }

    // Supprimer les anciens chunks de CE fichier uniquement
    await prisma.documentChunk.deleteMany({ where: { source: job.source } });

    const ai = getGenAI();
    let rawText: string;

    if (job.isText) {
      rawText = fs.readFileSync(job.filePath, "utf-8");
    } else {
      rawText = await extractTextInline(ai, job.filePath, job.mimeType);
    }

    const chunks = await indexDocument(ai, prisma, {
      documentId: null,
      mimeType:   job.mimeType,
      category:   job.category,
      platform:   job.platform,
      source:     job.source,
      rawText,
    });

    console.log(`[index-local] ✅ ${job.source} → ${chunks} chunks`);
    return apiSuccess({ source: job.source, chunks });
  } catch (error: any) {
    console.error("[index-local] ❌", error);
    return apiError(error.message || "Erreur lors de l'indexation.", 500);
  }
}
