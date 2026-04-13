import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/src/lib/prisma";
import { indexDocument } from "@/src/lib/rag";
import { waitUntil } from "@vercel/functions";
import * as fs from "fs";
import * as path from "path";

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("La clé d'API Gemini (GEMINI_API_KEY) n'est pas configurée.");
  // On utilise FORCÉMENT le Developer API car l'API de Fichiers (ai.files) 
  // n'existe PAS sur Vertex AI (qui nécessite des buckets Google Cloud Storage).
  return new GoogleGenAI({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ["ADMIN", "TEACHER"]);
    if ("status" in auth && auth.status !== 200) return auth;

    const formData = await request.formData();
    const file     = formData.get("file") as File;
    const category = formData.get("category") as string;
    let platform   = formData.get("platform") as string | null;

    if (!file || !category) {
      return apiError("Fichier et catégorie sont requis.");
    }

    if (platform === "NONE" || !platform) {
      platform = null;
    }

    // 1. Sauvegarde temporaire pour le SDK
    const bytes   = await file.arrayBuffer();
    const buffer  = Buffer.from(bytes);
    const tmpPath = path.join("/tmp", file.name);
    fs.writeFileSync(tmpPath, buffer);

    // 2. Upload vers Gemini File API
    const ai           = getGenAI();
    const uploadedFile: any = await ai.files.upload({
      file: tmpPath,
      config: {
        mimeType:    file.type || "application/octet-stream",
        displayName: file.name,
      },
    });

    let state       = uploadedFile.state;
    let currentFile = uploadedFile;

    // Attente du traitement Gemini
    while (state === "PROCESSING") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      currentFile = await ai.files.get({ name: uploadedFile.name });
      state       = (currentFile as any).state;
    }

    if (state === "FAILED") {
      fs.unlinkSync(tmpPath);
      throw new Error("Échec du traitement du fichier côté Gemini.");
    }

    const geminiUri = (currentFile as any).uri || uploadedFile.uri;
    const mimeType  = (currentFile as any).mimeType || file.type || "application/octet-stream";

    // 3. Enregistrement en Base de Données
    const document = await prisma.knowledgeDocument.create({
      data: {
        filename:    file.name,
        displayName: file.name,
        geminiUri,
        mimeType,
        category,
        platform,
        indexed:     false,
      },
    });

    // 4. Nettoyage local
    fs.unlinkSync(tmpPath);

    // 5. Indexation RAG en arrière-plan
    //    waitUntil garantit que Vercel ne tue pas la tâche après l'apiSuccess
    waitUntil(
      indexDocument(ai, prisma, {
        documentId: document.id,
        fileUri:    geminiUri,
        mimeType,
        category,
        platform,
      })
        .then((n) => console.log(`[RAG] ${n} chunks indexés pour "${file.name}"`))
        .catch((err) => console.error("[RAG] Erreur indexation:", err))
    );

    return apiSuccess({ document });
  } catch (error: any) {
    console.error("Erreur Upload Knowledge:", error);
    const details = error?.response?.data || error?.stack || error.message || "Erreur inconnue";
    return apiError(`Erreur détaillée: ${details}`, 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ["ADMIN", "TEACHER"]);
    if ("status" in auth && auth.status !== 200) return auth;

    const documents = await prisma.knowledgeDocument.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { chunks: true } } },
    });

    return apiSuccess({ documents });
  } catch (error: any) {
    return apiError(error.message || "Erreur de récupération.", 500);
  }
}
