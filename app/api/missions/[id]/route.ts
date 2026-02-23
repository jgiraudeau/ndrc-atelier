import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";

// DELETE /api/missions/[id] — Supprimer une mission
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(request, ["TEACHER"]);
    if ("status" in auth) return auth;

    try {
        const { id } = await params;

        const mission = await prisma.mission.findUnique({ where: { id } });
        if (!mission) return apiError("Mission introuvable", 404);
        if (mission.createdBy !== auth.payload.sub) return apiError("Non autorisé", 403);

        await prisma.mission.delete({ where: { id } });
        return apiSuccess({ deleted: true });
    } catch (err) {
        console.error("[missions/[id] DELETE]", err);
        return apiError("Erreur serveur", 500);
    }
}
