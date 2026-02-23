import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";

// PATCH /api/student/missions/[id] — Mettre à jour le statut d'une mission
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(request, ["STUDENT"]);
    if ("status" in auth) return auth;

    try {
        const { id } = await params;
        const { status } = await request.json();

        if (!["in_progress", "completed"].includes(status)) {
            return apiError("Statut invalide (in_progress ou completed)");
        }

        const assignment = await prisma.missionAssignment.findUnique({ where: { id } });
        if (!assignment) return apiError("Mission introuvable", 404);
        if (assignment.studentId !== auth.payload.sub) return apiError("Non autorisé", 403);

        const updated = await prisma.missionAssignment.update({
            where: { id },
            data: {
                status,
                ...(status === "completed" ? { completedAt: new Date() } : {}),
            },
        });

        return apiSuccess(updated);
    } catch (err) {
        console.error("[student/missions/[id] PATCH]", err);
        return apiError("Erreur serveur", 500);
    }
}
