import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";

// POST /api/comments — ajouter un commentaire (formateur uniquement)
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request, ["TEACHER"]);
    if ("status" in auth) return auth;
    const teacherId = auth.payload.sub;

    try {
        const { studentId, text } = await request.json();

        if (!studentId || !text?.trim()) {
            return apiError("studentId et text requis");
        }

        // Vérifier que l'élève appartient bien à ce formateur
        const student = await prisma.student.findFirst({
            where: { id: studentId, teacherId },
        });

        if (!student) {
            return apiError("Élève introuvable", 404);
        }

        const comment = await prisma.comment.create({
            data: { text: text.trim(), teacherId, studentId },
            include: { teacher: { select: { name: true } } },
        });

        return apiSuccess({
            id: comment.id,
            text: comment.text,
            authorName: comment.teacher.name,
            date: comment.createdAt.toISOString(),
        }, 201);
    } catch (err) {
        console.error("[comments/POST]", err);
        return apiError("Erreur serveur", 500);
    }
}
