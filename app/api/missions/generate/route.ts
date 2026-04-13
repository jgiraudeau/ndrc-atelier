import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";
import { ALL_COMPETENCIES } from "@/src/data/competencies";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/src/lib/prisma";
import { generateEmbedding, findRelevantChunks } from "@/src/lib/rag";
import fs from "fs";
import path from "path";

function getGenAI(): GoogleGenAI {
  const b64     = process.env.GOOGLE_CREDENTIALS_BASE64;
  const project = process.env.GOOGLE_CLOUD_PROJECT;

  if (b64 && project) {
    const json        = Buffer.from(b64, "base64").toString("utf-8");
    const credentials = JSON.parse(json);
    return new GoogleGenAI({
      vertexai: true,
      project,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? "europe-west1",
      googleAuthOptions: { credentials },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("La clé d'API Gemini n'est pas configurée côté serveur.");
  return new GoogleGenAI({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ["STUDENT", "TEACHER"]);
    if ("status" in auth) return auth;

    const { competencyIds, context, level = 2 } = await request.json();

    if (!competencyIds || !Array.isArray(competencyIds) || competencyIds.length === 0) {
      return apiError("Il faut fournir au moins un ID de compétence.");
    }

    let ai: GoogleGenAI;
    try {
      ai = getGenAI();
    } catch (err: unknown) {
      return apiError(err instanceof Error ? err.message : "IA non configurée", 500);
    }

    // Lookup competency details
    const compsToPractice = competencyIds
      .map((id: string) => ALL_COMPETENCIES.find((c) => c.id === id))
      .filter(Boolean);

    if (compsToPractice.length === 0) {
      return apiError("Aucune compétence valide trouvée.");
    }

    const validComps  = compsToPractice as NonNullable<typeof compsToPractice[0]>[];
    const compListText = validComps.map((c) => `- ${c.label} (${c.platform})`).join("\n");
    const platform    = validComps.length > 0 ? validComps[0].platform : "AGNOSTIC";
    const contextStr  = context || (platform === "WORDPRESS"
      ? "un site vitrine ou blog type WordPress"
      : "une boutique e-commerce Prestashop");

    let levelInstructions = "";
    switch (level) {
      case 1:
        levelInstructions = "C'est une mission de niveau **DÉCOUVERTE**. Sois extrêmement pédagogique. Donne des instructions très guidées, presque étape par étape (ex: 'Va dans le menu X, clique sur Y'). L'objectif est de rassurer l'étudiant.";
        break;
      case 2:
        levelInstructions = "C'est une mission de niveau **CONSTRUCTION**. Donne un scénario clair avec des objectifs précis, et rappelle quelques bonnes pratiques, mais sans forcément donner le chemin exact clic par clic dans le CMS.";
        break;
      case 3:
        levelInstructions = "C'est une mission de niveau **GESTION**. Comporte-toi comme un manager axé sur les résultats. Demande un objectif d'affaires (ex: 'Optimise le SEO de la page produit X pour booster les ventes'), l'étudiant doit savoir comment faire techniquement par lui-même.";
        break;
      case 4:
        levelInstructions = "C'est une mission de niveau **EXPERTISE**. Scénario complexe. Joue un client ou un manager très exigeant avec des contraintes de temps, de stratégie ou des objectifs ambitieux. Ne fournis absolument aucune aide technique ni piste dans le texte.";
        break;
      default:
        levelInstructions = "C'est une mission de niveau intermédiaire. Donne un scénario clair.";
    }

    const prompt = `
Tu es le directeur commercial/marketing d'une agence digitale.
Un étudiant (qui joue le rôle d'un employé) de BTS NDRC (Négociation et Digitalisation de la Relation Client) travaille sous ta tutelle.
Son entreprise/projet actuel est : ${contextStr}.

Ta mission : Lui rédiger un e-mail professionnel très réaliste lui donnant une **mission concrète** à réaliser sur son CMS (${platform}), afin qu'il puisse s'entraîner sur les points suivants :
${compListText}

**DIRECTIVES DE COMPLEXITÉ (IMPORTANT) :**
${levelInstructions}

L'e-mail doit globalement :
1. Avoir un ton professionnel adapté au niveau d'exigence (encourageant pour niveau 1, exigeant pour niveau 4).
2. Donner du sens "business" aux tâches techniques demandées.
3. Être formaté proprement en Markdown. Ne rajoute pas les blocs normaux typiques d'une conversation IA (type "Voici ton prompt..."), donne juste l'email.

Génère uniquement le contenu de cet email.
`;

    // ─── Vérification : des chunks RAG sont-ils disponibles ? ───────────────────
    const chunkCount = await prisma.documentChunk.count({
      where: { OR: [{ platform }, { platform: null }] },
    });

    const parts: any[] = [];

    if (chunkCount > 0) {
      // ── MODE RAG : recherche sémantique ──────────────────────────────────────
      // Requête sémantique = compétences + plateforme + niveau
      const queryText = [
        `Mission BTS NDRC E5, plateforme ${platform}, niveau ${level}.`,
        `Compétences visées : ${compListText}.`,
        `Contexte entreprise : ${contextStr}.`,
        "Référentiel, cours, sujets d'examen, attendus pédagogiques.",
      ].join(" ");

      const queryEmbedding = await generateEmbedding(ai, queryText);
      const relevantChunks = await findRelevantChunks(prisma, queryEmbedding, platform, 8);

      if (relevantChunks.length > 0) {
        parts.push({
          text:
            "Voici les extraits pédagogiques les plus pertinents issus de la base de connaissances " +
            "(référentiel BTS NDRC E5, fiches de cours, sujets d'examen). " +
            "Utilise-les pour que la mission soit cohérente avec les attendus officiels :\n\n",
        });
        relevantChunks.forEach((chunk) => {
          parts.push({
            text: `[${chunk.category}] ${chunk.content}\n\n`,
          });
        });
      }
    } else {
      // ── FALLBACK : comportement original si aucun chunk indexé ───────────────
      const knowledgeDir = path.join(process.cwd(), "knowledge");

      const getDocumentMimeType = (filename: string): string | null => {
        const ext = filename.split(".").pop()?.toLowerCase();
        switch (ext) {
          case "pdf":  return "application/pdf";
          case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
          default:     return null;
        }
      };

      if (fs.existsSync(knowledgeDir)) {
        const referentielDir = path.join(knowledgeDir, "referentiel");
        if (fs.existsSync(referentielDir)) {
          const refs = fs.readdirSync(referentielDir)
            .map((f) => ({ f, mime: getDocumentMimeType(f) }))
            .filter((x) => x.mime);
          if (refs.length > 0) {
            parts.push({ text: "Voici le référentiel officiel BTS NDRC E5 :\n" });
            refs.forEach(({ f, mime }) => {
              const base64 = fs.readFileSync(path.join(referentielDir, f)).toString("base64");
              parts.push({ inlineData: { data: base64, mimeType: mime! } });
            });
          }
        }

        const platformFolders: Record<string, string[]> = {
          WORDPRESS:  ["wordpress", "seo"],
          PRESTASHOP: ["prestashop"],
        };
        const courseParts: any[] = [];
        for (const folder of platformFolders[platform] || []) {
          const fp = path.join(knowledgeDir, folder);
          if (fs.existsSync(fp)) {
            for (const file of fs.readdirSync(fp)) {
              const mime = getDocumentMimeType(file);
              if (mime) {
                const base64 = fs.readFileSync(path.join(fp, file)).toString("base64");
                courseParts.push({ inlineData: { data: base64, mimeType: mime } });
              }
            }
          }
        }
        if (courseParts.length > 0) {
          parts.push({ text: "\nFiches de cours officielles :\n" });
          parts.push(...courseParts);
        }

        const sujetsBase = path.join(knowledgeDir, "sujets");
        if (fs.existsSync(sujetsBase)) {
          const sujetParts: any[] = [];
          for (const sub of [platform.toLowerCase(), "e5"]) {
            const sp = path.join(sujetsBase, sub);
            if (fs.existsSync(sp)) {
              for (const file of fs.readdirSync(sp)) {
                const mime = getDocumentMimeType(file);
                if (mime) {
                  const base64 = fs.readFileSync(path.join(sp, file)).toString("base64");
                  sujetParts.push({ inlineData: { data: base64, mimeType: mime } });
                }
              }
            }
          }
          for (const file of fs.readdirSync(sujetsBase)) {
            const fp   = path.join(sujetsBase, file);
            const mime = getDocumentMimeType(file);
            if (mime && !fs.statSync(fp).isDirectory()) {
              const base64 = fs.readFileSync(fp).toString("base64");
              sujetParts.push({ inlineData: { data: base64, mimeType: mime } });
            }
          }
          if (sujetParts.length > 0) {
            parts.push({ text: "\nSujets d'examen BTS NDRC E5 :\n" });
            parts.push(...sujetParts);
          }
        }
      }

      // Fallback DB : documents non indexés envoyés via fileData
      try {
        const dbDocs = await prisma.knowledgeDocument.findMany({
          where: { OR: [{ platform }, { platform: null }] },
        });
        if (dbDocs.length > 0) {
          parts.push({ text: "\nDocuments de la base de connaissances :\n" });
          dbDocs.forEach((doc: { displayName: string; category: string; geminiUri: string; mimeType: string }) => {
            parts.push({ text: `--- ${doc.displayName} (${doc.category}) ---\n` });
            parts.push({ fileData: { fileUri: doc.geminiUri, mimeType: doc.mimeType } });
          });
        }
      } catch (dbErr) {
        console.error("Erreur lecture KnowledgeDocument:", dbErr);
      }
    }

    // Fiches contextes entreprises (Markdown — toujours inclus, très légers)
    const contextesDir = path.join(process.cwd(), "knowledge", "contextes");
    if (fs.existsSync(contextesDir)) {
      const mdFiles = fs.readdirSync(contextesDir).filter((f) => f.endsWith(".md"));
      if (mdFiles.length > 0) {
        parts.push({ text: "\nFiches contextes entreprises :\n" });
        mdFiles.forEach((f) => {
          const content = fs.readFileSync(path.join(contextesDir, f), "utf-8");
          parts.push({ text: `--- ${f} ---\n${content}\n---\n` });
        });
      }
    }

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: parts,
      config: { temperature: 0.7 },
    });

    return apiSuccess({ mission: response.text });
  } catch (error: any) {
    console.error("Gemini Generate Error:", error);
    return apiError(error.message || "Erreur lors de la génération de la mission", 500);
  }
}
