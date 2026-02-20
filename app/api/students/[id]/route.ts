import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";

// PATCH /api/students/[id]
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireAuth(request, ["TEACHER"]);
    if ("status" in auth) return auth;

    try {
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
