import { Competency } from "@/src/types";

export const WORDPRESS_COMPETENCIES: Competency[] = [
    // --- NIVEAU 1 : DÉCOUVERTE ---
    {
        id: "wp-niv1-identite",
        level: 1,
        category: "Apparence",
        label: "Créer ou modifier l'identité du site (slogan, icône, logo)",
        platform: "WORDPRESS",
        isAcquired: false,
        autoCheckAvailable: true // On peut check l'API WP options
    },
    {
        id: "wp-niv1-header",
        level: 1,
        category: "Apparence",
        label: "Modifier l'en-tête (texte, photo et vidéo)",
        platform: "WORDPRESS",
        isAcquired: false
    },
    {
        id: "wp-niv1-menu-simple",
        level: 1,
        category: "Menu",
        label: "Créer ou modifier les menus et sous-menus (Emplacement principal)",
        platform: "WORDPRESS",
        isAcquired: false,
        autoCheckAvailable: true // API WP Menus
    },
    {
        id: "wp-niv1-article-page",
        level: 1,
        category: "Contenu",
        label: "Créer, modifier, publier et supprimer un article, une page et une catégorie",
        platform: "WORDPRESS",
        isAcquired: false,
        autoCheckAvailable: true // API WP Posts
    },
    {
        id: "wp-niv1-media-add",
        level: 1,
        category: "Image et vidéo",
        label: "Ajouter un média (photo, vidéo, audio)",
        platform: "WORDPRESS",
        isAcquired: false,
        autoCheckAvailable: true // API WP Media
    },

    // --- NIVEAU 2 : CONSTRUCTION ---
    {
        id: "wp-niv2-blocks-base",
        level: 2,
        category: "Contenu",
        label: "Utiliser les blocs : titre, paragraphe, bouton, bannière, image, galerie...",
        platform: "WORDPRESS",
        isAcquired: false
    },
    {
        id: "wp-niv2-spectra-base",
        level: 2,
        category: "Contenu",
        label: "Utiliser des blocs spécifiques Spectra (FAQ, Témoignages, Map, Team...)",
        platform: "WORDPRESS",
        isAcquired: false,
        autoCheckAvailable: false // Difficile de check le contenu du post content
    },
    {
        id: "wp-niv2-widgets",
        level: 2,
        category: "Apparence",
        label: "Gérer les widgets en pied de page et en colonne latérale",
        platform: "WORDPRESS",
        isAcquired: false
    },
    {
        id: "wp-niv2-gallery",
        level: 2,
        category: "Image et vidéo",
        label: "Insérer et modifier une galerie",
        platform: "WORDPRESS",
        isAcquired: false
    },
    {
        id: "wp-niv2-links",
        level: 2,
        category: "Contenu",
        label: "Créer et insérer des liens internes et externes",
        platform: "WORDPRESS",
        isAcquired: false
    },

    // --- NIVEAU 3 : GESTION ---
    {
        id: "wp-niv3-users",
        level: 3,
        category: "Utilisateurs",
        label: "Créer, modifier ou supprimer un compte / Attribuer un rôle",
        platform: "WORDPRESS",
        isAcquired: false,
        autoCheckAvailable: true // API WP Users
    },
    {
        id: "wp-niv3-comments",
        level: 3,
        category: "Contenu",
        label: "Modérer et répondre à un commentaire",
        platform: "WORDPRESS",
        isAcquired: false,
        autoCheckAvailable: true // API WP Comments
    },
    {
        id: "wp-niv3-popup",
        level: 3,
        category: "Contenu",
        label: "Créer un pop up ou une info bar via Spectra Pop Up Builder",
        platform: "WORDPRESS",
        isAcquired: false
    },
    {
        id: "wp-niv3-home-settings",
        level: 3,
        category: "Navigation",
        label: "Paramétrer la page d'accueil (statique ou derniers articles)",
        platform: "WORDPRESS",
        isAcquired: false,
        autoCheckAvailable: true // API WP Options reading
    },
    {
        id: "wp-niv3-privacy",
        level: 3,
        category: "Contenu",
        label: "Générer et compléter une page de politique de confidentialité",
        platform: "WORDPRESS",
        isAcquired: false,
        autoCheckAvailable: true // API WP Pages (slug privacy)
    },

    // --- NIVEAU 4 : EXPERTISE ---
    {
        id: "wp-niv4-seo-yoast",
        level: 4,
        category: "SEO",
        label: "Activer et utiliser l'extension Yoast SEO (requête cible, méta description)",
        platform: "WORDPRESS",
        isAcquired: false,
        autoCheckAvailable: true // API WP Plugins + Post Meta
    },
    {
        id: "wp-niv4-seo-structure",
        level: 4,
        category: "SEO",
        label: "Structurer le texte (hn), mots clés, étiquettes, balises alt",
        platform: "WORDPRESS",
        isAcquired: false
    },
    {
        id: "wp-niv4-menu-offcanvas",
        level: 4,
        category: "Menu",
        label: "Créer un menu hors champ / Ajouter un élément spécifique",
        platform: "WORDPRESS",
        isAcquired: false
    },
    {
        id: "wp-niv4-ariane",
        level: 4,
        category: "Navigation",
        label: "Insérer un fil d'Ariane",
        platform: "WORDPRESS",
        isAcquired: false
    }
];

export const PRESTASHOP_COMPETENCIES: Competency[] = [
    // --- NIVEAU 1 : DÉCOUVERTE ---
    {
        id: "ps-niv1-product-simple",
        level: 1,
        category: "Contenu",
        label: "Créer et gérer un produit (Simple)",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS Products
    },
    {
        id: "ps-niv1-category",
        level: 1,
        category: "Contenu",
        label: "Créer une catégorie et une sous-catégorie / Rattacher un produit",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS Categories
    },
    {
        id: "ps-niv1-online",
        level: 1,
        category: "Contenu",
        label: "Mettre en ligne un produit",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS Products (active=1)
    },
    {
        id: "ps-niv1-home-blocks",
        level: 1,
        category: "Apparence",
        label: "Modifier la position d'affichage des blocs sur la page d'accueil",
        platform: "PRESTASHOP",
        isAcquired: false
    },

    // --- NIVEAU 2 : CONSTRUCTION ---
    {
        id: "ps-niv2-combinations",
        level: 2,
        category: "Contenu",
        label: "Créer les déclinaisons d'un produit (Attributs/Caractéristiques)",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS Combinations
    },
    {
        id: "ps-niv2-brand",
        level: 2,
        category: "Contenu",
        label: "Créer une marque (Fabricant)",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS Manufacturers
    },
    {
        id: "ps-niv2-carrier",
        level: 2,
        category: "Contenu",
        label: "Créer et gérer un transporteur",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS Carriers
    },
    {
        id: "ps-niv2-stock",
        level: 2,
        category: "Contenu",
        label: "Gérer les stocks",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS StockAvailables
    },
    {
        id: "ps-niv2-pack",
        level: 2,
        category: "Contenu",
        label: "Créer un pack de produits / Associer deux produits",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS Products (type pack)
    },

    // --- NIVEAU 3 : GESTION ---
    {
        id: "ps-niv3-order",
        level: 3,
        category: "Commandes",
        label: "Créer et gérer une commande / Retours et Avoirs",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS Orders
    },
    {
        id: "ps-niv3-customer",
        level: 3,
        category: "Contenu",
        label: "Créer et gérer un client et un groupe de clients",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS Customers
    },
    {
        id: "ps-niv3-sav",
        level: 3,
        category: "Contenu",
        label: "Traiter les messages SAV / Rédiger des messages prédéfinis",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS CustomerThreads
    },
    {
        id: "ps-niv3-promo",
        level: 3,
        category: "Commandes",
        label: "Créer des promotions catalogue, panier et prix spécifique",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS CartRules / SpecificPrices
    },

    // --- NIVEAU 4 : EXPERTISE ---
    {
        id: "ps-niv4-modules",
        level: 4,
        category: "Module",
        label: "Configurer les modules (Produits phares, Carrousel, Réassurance, Partage...)",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: false // Difficile via API standard (config interne)
    },
    {
        id: "ps-niv4-seo",
        level: 4,
        category: "SEO",
        label: "Renseigner un mot-clé, une méta-description et une balise titre",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS Products (meta fields)
    },
    {
        id: "ps-niv4-users",
        level: 4,
        category: "Utilisateurs",
        label: "Créer un collaborateur / Permissions / Profils",
        platform: "PRESTASHOP",
        isAcquired: false,
        autoCheckAvailable: true // API PS Employees
    },
    {
        id: "ps-niv4-alias",
        level: 4,
        category: "Navigation",
        label: "Créer des alias",
        platform: "PRESTASHOP",
        isAcquired: false
    }
];

export const ALL_COMPETENCIES = [...WORDPRESS_COMPETENCIES, ...PRESTASHOP_COMPETENCIES];
