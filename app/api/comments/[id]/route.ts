import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";

// DELETE /api/comments/[id] — supprimer un commentaire
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(request, ["TEACHER"]);
    if ("status" in auth) return auth;
    const teacherId = auth.payload.sub;

    const { id } = await params;

    try {
        // Vérifie que ce commentaire appartient bien à ce formateur
        const comment = await prisma.comment.findFirst({
            where: { id, teacherId },
        });

        if (!comment) {
            return apiError("Commentaire introuvable", 404);
        }

        await prisma.comment.delete({ where: { id } });

        return apiSuccess({ deleted: true });
    } catch (err) {
        console.error("[comments/DELETE]", err);
        return apiError("Erreur serveur", 500);
    }
}
