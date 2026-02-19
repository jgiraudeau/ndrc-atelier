import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { url, platform } = await request.json();

        // Simulation de délai réseau (2s)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Simulation de validation
        // En vrai, on appellerait l'endpoint /wp-json/ndrc/v1/status du site de l'élève

        if (!url || !url.startsWith('http')) {
            return NextResponse.json({
                success: false,
                message: "URL invalide. Elle doit commencer par http:// ou https://"
            });
        }

        if (url.includes('error') || url.includes('echec')) {
            return NextResponse.json({
                success: false,
                message: "Impossible de contacter le plugin NDRC sur ce site (Erreur 404)."
            });
        }

        // Succès
        return NextResponse.json({
            success: true,
            message: `Connexion réussie au site ${platform} !`,
            details: {
                pluginVersion: "1.2.0",
                wordpressVersion: "6.4.2",
                lastActivity: new Date().toISOString()
            }
        });

    } catch (error) {
        return NextResponse.json({ success: false, message: "Erreur serveur interne." }, { status: 500 });
    }
}
