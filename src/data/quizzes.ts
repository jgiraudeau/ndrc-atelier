export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctAnswerIndex: number;
}

export const QUIZZES: Record<string, QuizQuestion[]> = {
    // WORDPRESS
    "wp-niv4-seo-yoast": [
        {
            id: "q1",
            question: "Dans Yoast SEO, à quoi sert la 'requête cible' ?",
            options: [
                "À définir le mot-clé principal sur lequel on veut être classé",
                "À acheter des mots-clés sur Google Ads",
                "À changer l'URL du site"
            ],
            correctAnswerIndex: 0
        },
        {
            id: "q2",
            question: "Où s'affiche la 'méta-description' configurée dans Yoast ?",
            options: [
                "Tout en haut de la page de l'article",
                "Dans les résultats de recherche Google en dessous du lien",
                "Dans le pied de page du site WordPress"
            ],
            correctAnswerIndex: 1
        },
        {
            id: "q3",
            question: "Que signifie le voyant vert dans Yoast SEO ?",
            options: [
                "L'article est publié automatiquement",
                "L'optimisation SEO de base est bonne pour le mot-clé choisi",
                "L'article est automatiquement numéro 1 sur Google"
            ],
            correctAnswerIndex: 1
        },
        {
            id: "q4",
            question: "Comment Yoast SEO analyse-t-il la lisibilité ?",
            options: [
                "En vérifiant la taille des images et la vitesse de chargement",
                "En s'assurant que le site utilise le mode sombre",
                "En analysant la longueur des phrases, la voix passive et les mots de transition"
            ],
            correctAnswerIndex: 2
        }
    ],
    "wp-niv1-identite": [
        {
            id: "wp-id-1",
            question: "Où modifie-t-on généralement le slogan (Tagline) d'un site WordPress ?",
            options: [
                "Dans Apparence > Personnaliser > Identité du site",
                "Dans Outils > Santé du site",
                "Dans Extensions > Ajouter"
            ],
            correctAnswerIndex: 0
        },
        {
            id: "wp-id-2",
            question: "Qu'est-ce qu'un favicon (ou l'icône du site) ?",
            options: [
                "La grande image d'en-tête de la page d'accueil",
                "La petite icône qui s'affiche dans l'onglet du navigateur web",
                "Le bouton qui permet d'ouvrir le menu sur mobile"
            ],
            correctAnswerIndex: 1
        },
        {
            id: "wp-id-3",
            question: "Quel est l'intérêt principal de renseigner un slogan clair ?",
            options: [
                "Réduire le temps de chargement des images",
                "Expliquer brièvement en quoi consiste le site aux visiteurs et à Google",
                "Changer automatiquement la couleur principale du thème"
            ],
            correctAnswerIndex: 1
        }
    ],
    "wp-niv2-blocks-base": [
        {
            id: "wp-blk-1",
            question: "Sous WordPress (Gutenberg), qu'est-ce qu'un bloc ?",
            options: [
                "Un virus qui bloque l'accès au site",
                "L'unité de base pour structurer le contenu (un paragraphe, une image, un titre...)",
                "Une extension payante pour faire des galeries"
            ],
            correctAnswerIndex: 1
        },
        {
            id: "wp-blk-2",
            question: "Comment ajouter rapidement un nouveau bloc dans l'éditeur de page ?",
            options: [
                "En cliquant sur le bouton '+' ou en tapant '/' suivi du nom du bloc",
                "En tapant du code HTML",
                "En allant dans le menu 'Réglages > Blocs'"
            ],
            correctAnswerIndex: 0
        },
        {
            id: "wp-blk-3",
            question: "À quoi sert le bloc 'Bannière' (Cover) ?",
            options: [
                "À afficher les publicités Google Ads",
                "À créer une image de fond avec du texte par-dessus",
                "À interdire l'accès au site"
            ],
            correctAnswerIndex: 1
        }
    ],

    // PRESTASHOP
    "ps-niv4-seo": [
        {
            id: "ps-seo-1",
            question: "Où se trouve la balise titre (meta title) pour optimiser un produit sous PrestaShop ?",
            options: [
                "Dans l'onglet 'Référencement - SEO' de la fiche produit",
                "Dans l'onglet 'Quantités'",
                "Dans le menu 'Paramètres Avancés'"
            ],
            correctAnswerIndex: 0
        },
        {
            id: "ps-seo-2",
            question: "À quoi sert le champ 'URL simplifiée' dans PrestaShop ?",
            options: [
                "A raccourcir le lien pour le partager sur Twitter (ex: bit.ly)",
                "A réécrire l'URL proprement (ex: /t-shirt-rouge) pour qu'elle soit comprise par Google",
                "A crypter l'adresse du site pour des raisons de sécurité"
            ],
            correctAnswerIndex: 1
        },
        {
            id: "ps-seo-3",
            question: "Quelle est la longueur recommandée pour une meta description efficace ?",
            options: [
                "Entre 20 et 50 caractères",
                "Environ 150 à 160 caractères",
                "Plus de 300 caractères"
            ],
            correctAnswerIndex: 1
        }
    ],
    "ps-niv1-product-simple": [
        {
            id: "ps-prod-1",
            question: "Avant de rendre un produit visible aux clients sur la boutique, que faut-il activer ?",
            options: [
                "Le mode maintenance",
                "Le statut 'Hors ligne / En ligne' du produit",
                "Le mode catalogue"
            ],
            correctAnswerIndex: 1
        },
        {
            id: "ps-prod-2",
            question: "Dans PrestaShop, quelle est la différence entre le prix HT et le prix TTC ?",
            options: [
                "Le prix HT n'inclut pas les frais de port",
                "Le prix TTC inclut les taxes (ex: la TVA)",
                "Le prix TTC est le prix fabricant"
            ],
            correctAnswerIndex: 1
        },
        {
            id: "ps-prod-3",
            question: "Où doit-on rédiger les caractéristiques détaillées du produit pour le visiteur ?",
            options: [
                "Dans le Récapitulatif (Description courte)",
                "Dans le champ 'Référencement SEO'",
                "Dans la Description complète"
            ],
            correctAnswerIndex: 2
        }
    ]
};
