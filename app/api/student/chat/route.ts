import { NextRequest } from "next/server";
import { requireAuth } from "@/src/lib/api-helpers";
import {
  generateEmbedding,
  findRelevantChunks,
  getGenAI,
  getGeminiDeveloperApiClient,
} from "@/src/lib/rag";
import { generateTextStream } from "@/src/lib/ai/gemini";
import { prisma } from "@/src/lib/prisma";
import type { Content } from "@google/genai";

// POST /api/student/chat
// Body: { message, platform?, pageContext?, history? }
// Returns: text/event-stream (SSE)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["STUDENT"]);
  if ("status" in auth) return auth;

  const { message, platform, pageContext, history = [] } = await request.json();

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return new Response(JSON.stringify({ error: "Message vide" }), { status: 400 });
  }

  // ── RAG : cherche les chunks pertinents ──────────────────────────────────
  let ragContext = "";
  try {
    const chunkCount = await prisma.documentChunk.count();
    if (chunkCount > 0) {
      let ai;
      try { ai = getGenAI(); } catch { ai = getGeminiDeveloperApiClient(); }

      const queryText = platform
        ? `${platform} BTS NDRC : ${message}`
        : `BTS NDRC : ${message}`;
      const embedding = await generateEmbedding(ai, queryText);
      const chunks = await findRelevantChunks(prisma, embedding, platform ?? "AGNOSTIC", 6);
      if (chunks.length > 0) {
        ragContext =
          "\n\n### Extraits de la base de connaissances :\n" +
          chunks
            .map((c, i) => `[${i + 1}] (${c.category}) ${c.content}`)
            .join("\n\n");
      }
    }
  } catch (err) {
    console.warn("[chat] RAG skipped:", err);
  }

  // ── Prompt système ───────────────────────────────────────────────────────
  const platformLabel =
    platform === "WORDPRESS"
      ? "WordPress"
      : platform === "PRESTASHOP"
      ? "PrestaShop"
      : null;

  const systemInstruction = `Tu es l'assistant pédagogique de la plateforme NDRC Atelier, dédié aux élèves en BTS NDRC (Négociation et Digitalisation de la Relation Client).

Ton rôle :
- Répondre aux questions sur les compétences E4 et E5 du BTS NDRC
- Aider sur ${platformLabel ? `la plateforme ${platformLabel}` : "WordPress et PrestaShop"}
- Expliquer les notions du référentiel BTS NDRC (gestion de la relation client, digitalisation, e-commerce, SEO, réseaux sociaux, etc.)
- Guider l'élève étape par étape, de façon claire et encourageante
- Utiliser des exemples concrets liés au commerce et au digital
${pageContext ? `- Contexte actuel de l'élève : ${pageContext}` : ""}

Règles :
- Réponds TOUJOURS en français
- Sois pédagogue, bienveillant et concis (max 4-5 paragraphes)
- Si tu utilises les extraits de la base de connaissances, intègre-les naturellement sans citer les numéros
- Si tu ne sais pas, dis-le honnêtement et oriente vers le formateur
- N'invente jamais d'informations techniques précises sur WordPress/PrestaShop si tu n'es pas sûr
${ragContext}`;

  // ── Historique de conversation ───────────────────────────────────────────
  const conversationHistory: Content[] = history
    .slice(-8) // max 4 échanges précédents
    .map((msg: { role: "user" | "assistant"; content: string }) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

  // Ajouter le message courant
  conversationHistory.push({
    role: "user",
    parts: [{ text: message }],
  });

  // ── Streaming SSE ────────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const textStream = generateTextStream(systemInstruction, conversationHistory, {
          model: "gemini-2.5-flash",
          temperature: 0.7,
          maxOutputTokens: 1024,
        });

        for await (const chunk of textStream) {
          const data = `data: ${JSON.stringify({ text: chunk })}\n\n`;
          controller.enqueue(encoder.encode(data));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        console.error("[chat] stream error:", err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "Erreur IA" })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
