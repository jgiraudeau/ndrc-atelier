import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";

// GET /api/students/[id] — détail complet d'un élève (formateur)
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(request, ["TEACHER"]);
    if ("status" in auth) return auth;

    try {
        const params = await context.params;
        const studentId = params.id;

        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                class: true,
                progress: true,
                comments: {
                    include: { teacher: true },
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        if (!student || student.teacherId !== auth.payload.sub) {
            return apiError("Élève introuvable", 404);
        }

        const acquiredCount = student.progress.filter((p: any) => p.acquired).length;

        let lastActive = null;
        if (student.progress.length > 0) {
            const sorted = [...student.progress].sort((a: any, b: any) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
            lastActive = sorted[0].updatedAt.toISOString();
        }

        return apiSuccess({
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            identifier: student.identifier,
            classCode: student.class.code,
            className: student.class.name,
            wpUrl: student.wpUrl,
            prestaUrl: student.prestaUrl,
            acquiredCount,
            lastActive,
            competencies: student.progress.map((p: any) => ({
                competencyId: p.competencyId,
                acquired: p.acquired,
                status: p.status,
                proof: p.proof,
                updatedAt: p.updatedAt.toISOString(),
                teacherStatus: p.teacherStatus,
                teacherFeedback: p.teacherFeedback,
                teacherGradedAt: p.teacherGradedAt?.toISOString() ?? null,
            })),
            comments: student.comments.map((c: any) => ({
                id: c.id,
                text: c.text,
                authorName: c.teacher?.name || "Professeur",
                date: c.createdAt.toISOString(),
            })),
        });
    } catch (error) {
        console.error("[GET /api/students/[id]] Error:", error);
        return apiError("Erreur serveur", 500);
    }
}

// PATCH /api/students/[id]
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(request, ["TEACHER"]);
    if ("status" in auth) return auth;

    try {
        const params = await context.params;
        const studentId = params.id;
        const body = await request.json();

        // Check if student belongs to the teacher
        const existingStudent = await prisma.student.findUnique({
            where: { id: studentId },
        });

        if (!existingStudent) {
            return apiError("Élève introuvable", 404);
        }

        if (existingStudent.teacherId !== auth.payload.sub) {
            return apiError("Non autorisé à modifier cet élève", 403);
        }

        const dataToUpdate: any = {};
        if (body.wpUrl !== undefined) dataToUpdate.wpUrl = body.wpUrl;
        if (body.prestaUrl !== undefined) dataToUpdate.prestaUrl = body.prestaUrl;

        if (Object.keys(dataToUpdate).length === 0) {
            return apiError("Aucune donnée à mettre à jour", 400);
        }

        const updatedStudent = await prisma.student.update({
            where: { id: studentId },
            data: dataToUpdate,
        });

        return apiSuccess({
            message: "Élève mis à jour",
            student: updatedStudent,
        });
    } catch (error) {
        console.error("[PATCH /api/students/[id]] Error:", error);
        return apiError("Erreur serveur lors de la mise à jour de l'élève", 500);
    }
}
