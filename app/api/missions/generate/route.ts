import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";
import { ALL_COMPETENCIES } from "@/src/data/competencies";
import { generateText } from "@/src/lib/ai/gemini";
import {
  generateEmbedding,
  findRelevantChunks,
  getGenAI,
  getGeminiDeveloperApiClient,
} from "@/src/lib/rag";
import { prisma } from "@/src/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ["STUDENT", "TEACHER"]);
    if ("status" in auth) return auth;

    const { competencyIds, context, level = 2 } = await request.json();

    if (!competencyIds || !Array.isArray(competencyIds) || competencyIds.length === 0) {
      return apiError("Il faut fournir au moins un ID de compétence.");
    }

    const compsToPractice = competencyIds
      .map((id: string) => ALL_COMPETENCIES.find((c) => c.id === id))
      .filter(Boolean);

    if (compsToPractice.length === 0) {
      return apiError("Aucune compétence valide trouvée.");
    }

    const validComps = compsToPractice as NonNullable<typeof compsToPractice[0]>[];
    const compListText = validComps.map((c) => `- ${c.label} (${c.platform})`).join("\n");
    const platform = validComps.length > 0 ? validComps[0].platform : "AGNOSTIC";
    const contextStr =
      context ||
      (platform === "WORDPRESS"
        ? "un site vitrine ou blog type WordPress"
        : "une boutique e-commerce Prestashop");

    let levelInstructions = "";
    switch (level) {
      case 1:
        levelInstructions =
          "C'est une mission de niveau **DÉCOUVERTE**. Sois extrêmement pédagogique. Donne des instructions très guidées, presque étape par étape (ex: 'Va dans le menu X, clique sur Y'). L'objectif est de rassurer l'étudiant.";
        break;
      case 2:
        levelInstructions =
          "C'est une mission de niveau **CONSTRUCTION**. Donne un scénario clair avec des objectifs précis, et rappelle quelques bonnes pratiques, mais sans forcément donner le chemin exact clic par clic dans le CMS.";
        break;
      case 3:
        levelInstructions =
          "C'est une mission de niveau **GESTION**. Comporte-toi comme un manager axé sur les résultats. Demande un objectif d'affaires (ex: 'Optimise le SEO de la page produit X pour booster les ventes'), l'étudiant doit savoir comment faire techniquement par lui-même.";
        break;
      case 4:
        levelInstructions =
          "C'est une mission de niveau **EXPERTISE**. Scénario complexe. Joue un client ou un manager très exigeant avec des contraintes de temps, de stratégie ou des objectifs ambitieux. Ne fournis absolument aucune aide technique ni piste dans le texte.";
        break;
      default:
        levelInstructions = "C'est une mission de niveau intermédiaire. Donne un scénario clair.";
    }

    // ── RAG DB (même stratégie que le chat élève) ─────────────────────────
    let ragContext = "";
    try {
      const chunkCount = await prisma.documentChunk.count();
      if (chunkCount > 0) {
        let ai;
        try { ai = getGenAI(); } catch { ai = getGeminiDeveloperApiClient(); }

        const queryText = `${platform} BTS NDRC compétences : ${compListText}`;
        const embedding = await generateEmbedding(ai, queryText);
        const chunks = await findRelevantChunks(prisma, embedding, platform, 8);
        if (chunks.length > 0) {
          ragContext =
            "\n\n### Extraits de la base de connaissances (référentiel, tutoriels, sujets) :\n" +
            chunks.map((c, i) => `[${i + 1}] (${c.category}) ${c.content}`).join("\n\n");
        }
      }
    } catch (err) {
      console.warn("[missions/generate] RAG skipped:", err);
    }

    const systemPrompt = `Tu es le directeur commercial/marketing d'une agence digitale.
Tu encadres un étudiant de BTS NDRC.
Utilise prioritairement les extraits de la base de connaissances fournis ci-dessous (référentiel officiel, tutoriels, sujets d'examen).
Si une information n'est pas dans ces extraits, reste prudent et évite d'inventer des détails normatifs.${ragContext}`;

    const userPrompt = `
Son entreprise/projet actuel est : ${contextStr}.

Rédige un e-mail professionnel très réaliste donnant une **mission concrète** à réaliser sur son CMS (${platform}), afin qu'il puisse s'entraîner sur :
${compListText}

**DIRECTIVES DE COMPLEXITÉ (IMPORTANT) :**
${levelInstructions}

Contraintes:
1. Ton professionnel adapté au niveau (encourageant niveau 1, exigeant niveau 4).
2. Donner du sens business aux tâches techniques.
3. Format Markdown propre.
4. Réponds uniquement avec le contenu de l'email.`;

    const mission = await generateText(systemPrompt, userPrompt, {
      model: "gemini-2.5-flash",
      temperature: 0.7,
      maxOutputTokens: 4096,
    });

    if (!mission.trim()) {
      return apiError("La génération de mission a retourné une réponse vide.", 500);
    }

    return apiSuccess({ mission });
  } catch (error: unknown) {
    console.error("Gemini Generate Error:", error);
    return apiError(
      error instanceof Error ? error.message : "Erreur lors de la génération de la mission",
      500
    );
  }
}
