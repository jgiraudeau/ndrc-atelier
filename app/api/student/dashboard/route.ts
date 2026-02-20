import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";
import { ALL_COMPETENCIES } from "@/src/data/competencies";

// GET /api/student/dashboard
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request, ["STUDENT"]);
    if ("status" in auth) return auth;
    const studentId = auth.payload.sub;

    try {
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                progress: true,
                comments: {
                    orderBy: { createdAt: "desc" },
                    include: { teacher: { select: { name: true } } },
                },
                class: { select: { code: true } }, // Include class code
            },
        });

        if (!student) {
            return apiError("Élève introuvable", 404);
        }

        const acquiredCount = student.progress.filter((p: any) => p.acquired).length;
        const totalCompetencies = ALL_COMPETENCIES.length;
        const progressPercentage = totalCompetencies > 0
            ? Math.round((acquiredCount / totalCompetencies) * 100)
            : 0;

        // Séparer progression par plateforme
        const wpIds = ALL_COMPETENCIES.filter(c => c.platform === "WORDPRESS").map(c => c.id);
        const psIds = ALL_COMPETENCIES.filter(c => c.platform === "PRESTASHOP").map(c => c.id);

        const wpAcquired = student.progress.filter((p: any) => p.acquired && wpIds.includes(p.competencyId)).length;
        const psAcquired = student.progress.filter((p: any) => p.acquired && psIds.includes(p.competencyId)).length;

        const recentActivity = student.progress
            .sort((a: any, b: any) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, 5)
            .map((p: any) => {
                const comp = ALL_COMPETENCIES.find(c => c.id === p.competencyId);
                return {
                    id: p.competencyId,
                    label: comp?.label || p.competencyId,
                    platform: comp?.platform || "UNKNOWN",
                    date: p.updatedAt.toISOString(),
                };
            });

        return apiSuccess({
            firstName: student.firstName,
            lastName: student.lastName,
            classCode: student.class.code,
            wpUrl: student.wpUrl,
            prestaUrl: student.prestaUrl,
            progress: {
                total: progressPercentage,
                wordpress: Math.round((wpAcquired / wpIds.length) * 100) || 0,
                prestashop: Math.round((psAcquired / psIds.length) * 100) || 0,
                acquiredCount,
                totalCount: totalCompetencies
            },
            recentActivity,
            comments: student.comments.map((c: any) => ({
                id: c.id,
                text: c.text,
                author: c.teacher.name,
                date: c.createdAt.toISOString(),
            })),
        });
    } catch (err) {
        console.error("[student/dashboard]", err);
        return apiError("Erreur serveur", 500);
    }
}
