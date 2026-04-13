/**
 * POST /api/admin/knowledge/index-local
 *
 * Scanne le dossier /knowledge/ du projet, extrait le texte de chaque fichier
 * via Gemini File API, génère les embeddings et stocke les chunks en DB.
 *
 * Une fois indexés, ces fichiers ne sont PLUS envoyés en base64 à chaque
 * génération de mission → économie massive de tokens.
 *
 * Idempotent : appeler plusieurs fois est sans danger (les anciens chunks
 * locaux sont supprimés et recréés).
 */
import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/src/lib/prisma";
import { indexDocument } from "@/src/lib/rag";
import fs from "fs";
import path from "path";

export const maxDuration = 300; // Vercel Pro : 5 min max

// ─── Mapping dossier → catégorie / plateforme ────────────────────────────────

type FolderEntry = {
  folder:   string;
  category: string;
  platform: string | null;
  rootOnly?: boolean; // true = seulement les fichiers à la racine du dossier
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

function getGenAI(): GoogleGenAI {
  const b64     = process.env.GOOGLE_CREDENTIALS_BASE64;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (b64 && project) {
    const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
    return new GoogleGenAI({
      vertexai: true, project,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? "europe-west1",
      googleAuthOptions: { credentials },
    });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant.");
  return new GoogleGenAI({ apiKey });
}

function getMimeType(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_MIME[ext] ?? null;
}

function isTextFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ext === "md" || ext === "txt";
}

/**
 * Extrait le texte d'un fichier binaire (PDF, DOCX…) en l'envoyant
 * directement en base64 via generateContent (inlineData).
 * Plus rapide et fiable que le File API pour les fichiers locaux.
 */
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

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ["ADMIN"]);
    if ("status" in auth && auth.status !== 200) return auth;

    const knowledgeDir = path.join(process.cwd(), "knowledge");
    if (!fs.existsSync(knowledgeDir)) {
      return apiError("Dossier /knowledge introuvable sur ce déploiement.", 404);
    }

    const ai = getGenAI();

    // 1. Supprimer tous les anciens chunks locaux pour re-partir proprement
    const deleted = await prisma.documentChunk.deleteMany({
      where: { source: { startsWith: "local:" } },
    });
    console.log(`[index-local] ${deleted.count} anciens chunks locaux supprimés`);

    // 2. Collecter tous les fichiers à indexer
    type FileJob = {
      filePath: string;
      filename: string;
      mimeType: string;
      category: string;
      platform: string | null;
      source:   string;
      isText:   boolean;
    };

    const jobs: FileJob[] = [];

    for (const entry of FOLDER_MAP) {
      const folderPath = path.join(knowledgeDir, entry.folder);
      if (!fs.existsSync(folderPath)) continue;

      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        const fullPath = path.join(folderPath, file);
        const stat     = fs.statSync(fullPath);
        if (stat.isDirectory()) continue;
        if (entry.rootOnly && fullPath !== path.join(folderPath, file)) continue;

        const mimeType = getMimeType(file);
        if (!mimeType) continue;

        jobs.push({
          filePath: fullPath,
          filename: file,
          mimeType,
          category: entry.category,
          platform: entry.platform,
          source:   `local:${entry.folder}/${file}`,
          isText:   isTextFile(file),
        });
      }
    }

    if (jobs.length === 0) {
      return apiSuccess({
        message: "Aucun fichier trouvé dans /knowledge/.",
        indexed: 0,
        total:   0,
        results: [],
      });
    }

    console.log(`[index-local] ${jobs.length} fichier(s) à indexer`);

    // 3. Indexer chaque fichier
    const results: { file: string; chunks: number; error?: string }[] = [];

    for (const job of jobs) {
      try {
        let chunks: number;

        // Extraction du texte selon le type de fichier
        let rawText: string;
        if (job.isText) {
          // Markdown / TXT : lecture directe
          rawText = fs.readFileSync(job.filePath, "utf-8");
        } else {
          // PDF / DOCX : extraction via inlineData base64 (plus rapide que File API)
          rawText = await extractTextInline(ai, job.filePath, job.mimeType);
        }

        chunks = await indexDocument(ai, prisma, {
          documentId: null,
          fileUri:    "",
          mimeType:   job.mimeType,
          category:   job.category,
          platform:   job.platform,
          source:     job.source,
          rawText,
        });

        results.push({ file: job.source, chunks });
        console.log(`[index-local] ✅ ${job.source} → ${chunks} chunks`);
      } catch (err: any) {
        results.push({ file: job.source, chunks: 0, error: err.message });
        console.error(`[index-local] ❌ ${job.source}:`, err.message);
      }
    }

    const total = results.reduce((sum, r) => sum + r.chunks, 0);
    return apiSuccess({
      message: `${results.filter(r => !r.error).length}/${jobs.length} fichier(s) indexé(s) — ${total} chunks créés.`,
      indexed: results.filter(r => !r.error).length,
      total,
      results,
    });
  } catch (error: any) {
    console.error("[index-local] Erreur:", error);
    return apiError(error.message || "Erreur lors de l'indexation locale.", 500);
  }
}
