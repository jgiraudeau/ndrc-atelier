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

        // Vérification de la taille (limiter à 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: "Fichier trop lourd (Max: 5MB)" }, { status: 400 });
        }

        // Liste blanche des types MIME et extensions non exécutables
        const allowedMimeTypes = [
            'image/jpeg', 
            'image/png', 
            'image/webp', 
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
        ];
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'docx'];
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

        if (!allowedMimeTypes.includes(file.type) || !allowedExtensions.includes(fileExtension)) {
            return NextResponse.json({ error: "Format de fichier non autorisé (Seuls JPG, PNG, WEBP, PDF, DOCX sont acceptés)" }, { status: 400 });
        }

        // Nom unique propre
        const cleanName = `proof-${auth.payload.sub}-${Date.now()}.${fileExtension}`;

        const blob = await put(`proofs/${cleanName}`, file, {
            access: 'public',
        });

        return NextResponse.json({ url: blob.url });
    } catch (error) {
        console.error("[api/upload] Erreur:", error);
        return NextResponse.json({ error: "Erreur lors de l'upload" }, { status: 500 });
    }
}
