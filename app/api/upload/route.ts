import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/api-helpers';

export async function POST(request: NextRequest) {
    // Vérification de l'utilisateur (Élève autorisé à uploader)
    const auth = await requireAuth(request, ["STUDENT"]);
    if ("status" in auth) return auth;

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
        }

        // Vérification de la taille (Optionnel : limiter à 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: "Image trop lourde (Max: 5MB)" }, { status: 400 });
        }

        // Nom unique propre
        const extension = file.name.split('.').pop() || 'png';
        const cleanName = `proof-${auth.payload.sub}-${Date.now()}.${extension}`;

        const blob = await put(`proofs/${cleanName}`, file, {
            access: 'public',
        });

        return NextResponse.json({ url: blob.url });
    } catch (error) {
        console.error("[api/upload] Erreur:", error);
        return NextResponse.json({ error: "Erreur lors de l'upload" }, { status: 500 });
    }
}
