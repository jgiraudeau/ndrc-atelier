export type Platform = 'WORDPRESS' | 'PRESTASHOP';

export interface Competency {
    id: string;
    category: string; // ex: "Apparence", "Contenu", "SEO"
    level: number; // 1 to 4
    label: string; // ex: "Installer l'extension Yoast"
    platform: Platform;
    isAcquired: boolean;
    // Smart Check features
    autoCheckAvailable?: boolean; // True si on peut valider via API
    checkEndpoint?: string; // ex: "/api/check-plugin?plugin=wordpress-seo"
}

export interface StudentSite {
    platform: Platform;
    url: string; // ex: "https://mon-site-etudiant.o2switch.net"
    // Pour WordPress: Application Password
    // Pour PrestaShop: Webservice Key
    apiKey?: string;
    isValidated: boolean; // Si l'app a réussi à se connecter
}

export interface StudentProfile {
    id: string;
    name: string;
    sites: {
        wordpress?: StudentSite;
        prestashop?: StudentSite;
    };
    progress: {
        [competencyId: string]: {
            status: 'PENDING' | 'ACQUIRED' | 'VALIDATED_BY_API';
            lastChecked?: Date;
            evidenceUrl?: string; // Screenshot si pas d'API
        }
    }
}
