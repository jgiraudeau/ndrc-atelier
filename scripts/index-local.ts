import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

// Charge les variables d'environnement en tout premier (avant Prisma)
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant dans .env");
  return new GoogleGenAI({ apiKey });
}

// ─── CONFIGURATION DES DOSSIERS ────────────────────────────────────────────────
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

function getMimeType(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_MIME[ext] ?? null;
}

function isTextFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ext === "md" || ext === "txt";
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      if (attempt >= retries || (e.status !== 503 && !e.message?.includes("timed out"))) {
        throw e;
      }
      console.log(`      ⏱️ API surchargée (timeout/503). Pause 10s avant retry ${attempt + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, 10000));
      attempt++;
    }
  }
}

async function extractTextInline(ai: any, filePath: string, mimeType: string): Promise<string> {
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
              "Extrais intégralement le texte de ce document. Retourne uniquement le texte brut, sans mise en forme, sans commentaire, sans introduction ni conclusion.",
          },
        ],
      },
    ],
  });
  return response.text ?? "";
}

// ─── SCRIPT PRINCIPAL ──────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 [OFFLINE INDEXER] Démarrage de l'indexation locale massive...");
  
  const knowledgeDir = path.join(process.cwd(), "knowledge");
  if (!fs.existsSync(knowledgeDir)) {
    console.error("❌ Dossier /knowledge introuvable.");
    process.exit(1);
  }

  // Importer de manière dynamique (une fois les .env chargés !)
  const { prisma } = await import("../src/lib/prisma");
  const { indexDocument } = await import("../src/lib/rag");
  const { GoogleGenAI } = await import("@google/genai");

  function getGenAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY manquant dans .env");
    return new GoogleGenAI({ apiKey });
  }

  // Purge globale initiale (Optionnel, mettez 'true' si vous voulez tout écraser)
  const purgeAll = process.argv.includes("--purge");
  if (purgeAll) {
    const deleted = await prisma.documentChunk.deleteMany({
      where: { source: { startsWith: "local:" } },
    });
    console.log(`🧹 Purge complète : ${deleted.count} chunks supprimés de la DB.`);
  }

  const ai = getGenAI();
  let totalIndexed = 0;
  let totalChunks = 0;

  for (const entry of FOLDER_MAP) {
    const folderPath = path.join(knowledgeDir, entry.folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      if (file.startsWith(".")) continue;
      
      const fullPath = path.join(folderPath, file);
      if (fs.statSync(fullPath).isDirectory()) continue;

      const mimeType = getMimeType(file);
      if (!mimeType) continue;

      const source = `local:${entry.folder}/${file}`;
      console.log(`\n⏳ Traitement en cours : ${source} ...`);

      try {
        // Nettoyage spécifique de cet ancien fichier
        await prisma.documentChunk.deleteMany({ where: { source } });

        let rawText: string;
        if (isTextFile(file)) {
          rawText = fs.readFileSync(fullPath, "utf-8");
        } else {
          rawText = await withRetry(() => extractTextInline(ai, fullPath, mimeType));
        }

        const chunks = await withRetry(() => indexDocument(ai, prisma, {
          documentId: null,
          fileUri:    "",
          mimeType:   mimeType,
          category:   entry.category,
          platform:   entry.platform,
          source:     source,
          rawText:    rawText,
        }));

        console.log(`✅ Succès : ${chunks} chunks insérés pour ${source}`);
        totalIndexed++;
        totalChunks += chunks;

        // Petit délai de sécurité pour éviter de sur-solliciter l'API de Google entre chaque fichier
        await new Promise(r => setTimeout(r, 2000));
      } catch (err: any) {
        console.error(`❌ Échec définitif pour ${source} :`, err.message);
      }
    }
  }

  console.log(`\n🎉 TERMINÉ ! ${totalIndexed} fichiers indexés pour un total de ${totalChunks} chunks.`);
  await prisma.$disconnect();
}

main().catch(console.error);
