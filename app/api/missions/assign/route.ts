import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";

// POST /api/missions/assign — Assigner une mission à des étudiants
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request, ["TEACHER"]);
    if ("status" in auth) return auth;

    try {
        const { missionId, studentIds, classId } = await request.json();

        if (!missionId) return apiError("missionId requis");

        const mission = await prisma.mission.findUnique({ where: { id: missionId } });
        if (!mission) return apiError("Mission introuvable", 404);

        let targetIds: string[] = studentIds || [];

        // Si classId fourni, récupérer tous les étudiants de cette classe
        if (classId) {
            const students = await prisma.student.findMany({
                where: { classId, teacherId: auth.payload.sub },
                select: { id: true },
            });
            targetIds = students.map(s => s.id);
        }

        if (targetIds.length === 0) {
            return apiError("Aucun étudiant sélectionné");
        }

        const result = await prisma.missionAssignment.createMany({
            data: targetIds.map(studentId => ({
                missionId,
                studentId,
                teacherId: auth.payload.sub,
            })),
            skipDuplicates: true,
        });

        return apiSuccess({ assigned: result.count });
    } catch (err) {
        console.error("[missions/assign POST]", err);
        return apiError("Erreur serveur", 500);
    }
}
