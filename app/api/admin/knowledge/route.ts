import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";
import { prisma } from "@/src/lib/prisma";
import { indexDocument, getGenAI } from "@/src/lib/rag";
import { waitUntil } from "@vercel/functions";

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

    // 1. Convertir en Base64 pour l'envoi en streaming
    const bytes = await file.arrayBuffer();
    const inlineBase64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "application/octet-stream";

    // 2. Enregistrement en Base de Données (sans geminiUri ni rawText pour le moment)
    const document = await prisma.knowledgeDocument.create({
      data: {
        filename:    file.name,
        displayName: file.name,
        mimeType,
        category,
        platform,
        indexed:     false,
      },
    });

    const ai = getGenAI();

    // 3. Indexation RAG en arrière-plan
    // waitUntil garantit que Vercel exécute ce code même après avoir retourné 'success'
    waitUntil(
      indexDocument(ai, prisma, {
        documentId: document.id,
        inlineBase64,
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
