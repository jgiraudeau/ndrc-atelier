import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";

// PATCH /api/student/password — changer son mot de passe
export async function PATCH(request: NextRequest) {
    const auth = await requireAuth(request, ["STUDENT"]);
    if ("status" in auth) return auth;

    try {
        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return apiError("Ancien et nouveau mot de passe requis");
        }

        if (newPassword.length < 4) {
            return apiError("Le nouveau mot de passe doit faire au moins 4 caractères");
        }

        const student = await prisma.student.findUnique({
            where: { id: auth.payload.sub },
        });

        if (!student) {
            return apiError("Élève introuvable", 404);
        }

        const valid = await bcrypt.compare(currentPassword, student.passwordHash);
        if (!valid) {
            return apiError("Ancien mot de passe incorrect", 401);
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await prisma.student.update({
            where: { id: student.id },
            data: { passwordHash },
        });

        return apiSuccess({ message: "Mot de passe modifié avec succès" });
    } catch (err) {
        console.error("[student/password PATCH]", err);
        return apiError("Erreur serveur", 500);
    }
}
