/**
 * POST /api/admin/knowledge/reindex
 *
 * Re-indexe tous les KnowledgeDocuments existants en base :
 * extrait le texte via Gemini, découpe en chunks, génère les embeddings.
 *
 * À appeler manuellement depuis l'interface admin après la première mise en
 * production du système RAG, ou pour forcer la re-indexation de tous les docs.
 */
import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/src/lib/prisma";
import { indexDocument } from "@/src/lib/rag";

export const maxDuration = 300; // Vercel Pro : 5 min max

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant.");
  return new GoogleGenAI({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ["ADMIN"]);
    if ("status" in auth && auth.status !== 200) return auth;

    // Optionnel : forcer la re-indexation même des docs déjà indexés
    const { forceAll = false } = await request.json().catch(() => ({}));

    const docs = await prisma.knowledgeDocument.findMany({
      where: forceAll ? {} : { indexed: false },
      orderBy: { createdAt: "asc" },
    });

    if (docs.length === 0) {
      return apiSuccess({ message: "Tous les documents sont déjà indexés.", indexed: 0 });
    }

    const ai = getGenAI();
    const results: { id: string; name: string; chunks: number; error?: string }[] = [];

    for (const doc of docs) {
      try {
        const chunks = await indexDocument(ai, prisma, {
          documentId: doc.id,
          fileUri:    doc.geminiUri,
          mimeType:   doc.mimeType,
          category:   doc.category,
          platform:   doc.platform,
        });
        results.push({ id: doc.id, name: doc.displayName, chunks });
        console.log(`[RAG] ✅ ${doc.displayName} → ${chunks} chunks`);
      } catch (err: any) {
        results.push({ id: doc.id, name: doc.displayName, chunks: 0, error: err.message });
        console.error(`[RAG] ❌ ${doc.displayName}:`, err.message);
      }
    }

    const total = results.reduce((sum, r) => sum + r.chunks, 0);
    return apiSuccess({
      message: `${results.length} document(s) traité(s), ${total} chunks créés.`,
      indexed: results.length,
      total,
      results,
    });
  } catch (error: any) {
    console.error("[RAG] Erreur reindex:", error);
    return apiError(error.message || "Erreur lors de la ré-indexation.", 500);
  }
}
