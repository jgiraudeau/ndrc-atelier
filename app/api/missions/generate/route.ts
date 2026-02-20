import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";
import { ALL_COMPETENCIES } from "@/src/data/competencies";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAuth(request, ["STUDENT"]);
        if ("status" in auth) return auth;

        const { competencyIds, context, level = 2 } = await request.json();

        if (!competencyIds || !Array.isArray(competencyIds) || competencyIds.length === 0) {
            return apiError("Il faut fournir au moins un ID de compétence.");
        }

        if (!process.env.GEMINI_API_KEY) {
            return apiError("La clé d'API Gemini n'est pas configurée côté serveur.", 500);
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Lookup competency details
        const compsToPractice = competencyIds
            .map(id => ALL_COMPETENCIES.find(c => c.id === id))
            .filter(Boolean);

        if (compsToPractice.length === 0) {
            return apiError("Aucune compétence valide trouvée.");
        }

        // Construct context-rich details
        const validComps = compsToPractice as NonNullable<typeof compsToPractice[0]>[];

        const compListText = validComps.map(c => `- ${c.label} (${c.platform})`).join('\n');

        const platform = validComps.length > 0 ? validComps[0].platform : "AGNOSTIC"; // Determine primary platform context
        const contextStr = context || (platform === "WORDPRESS" ? "un site vitrine ou blog type WordPress" : "une boutique e-commerce Prestashop");

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

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                temperature: 0.7,
            },
        });

        return apiSuccess({ mission: response.text });

    } catch (error: any) {
        console.error("Gemini Generate Error:", error);
        return apiError(error.message || "Erreur lors de la génération de la mission", 500);
    }
}
