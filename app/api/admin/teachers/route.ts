import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";

// GET /api/admin/teachers - Liste tous les profs
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if ("status" in auth) return auth;

    try {
        const teachers = await prisma.teacher.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                status: true,
                createdAt: true,
                _count: {
                    select: {
                        students: true,
                        classes: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return apiSuccess(teachers);
    } catch (err) {
        console.error("[admin/teachers GET]", err);
        return apiError("Erreur serveur", 500);
    }
}

// PATCH /api/admin/teachers - Valider, rejeter ou supprimer un prof
export async function PATCH(request: NextRequest) {
    const auth = await requireAuth(request, ["ADMIN"]);
    if ("status" in auth) return auth;

    try {
        const { teacherId, action } = await request.json();

        if (!teacherId || !action) {
            return apiError("teacherId et action requis");
        }

        if (!["approve", "reject", "delete"].includes(action)) {
            return apiError("Action invalide (approve, reject, delete)");
        }

        const teacher = await prisma.teacher.findUnique({
            where: { id: teacherId },
        });

        if (!teacher) {
            return apiError("Formateur introuvable", 404);
        }

        if (action === "delete") {
            await prisma.teacher.delete({ where: { id: teacherId } });
            return apiSuccess({ message: "Formateur supprimé" });
        }

        const newStatus = action === "approve" ? "active" : "rejected";
        await prisma.teacher.update({
            where: { id: teacherId },
            data: { status: newStatus },
        });

        return apiSuccess({ message: `Formateur ${action === "approve" ? "validé" : "rejeté"}` });
    } catch (err) {
        console.error("[admin/teachers PATCH]", err);
        return apiError("Erreur serveur", 500);
    }
}
