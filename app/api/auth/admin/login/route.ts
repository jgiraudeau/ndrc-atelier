import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { signToken } from "@/src/lib/jwt";
import { apiError, apiSuccess } from "@/src/lib/api-helpers";
import { prisma } from "@/src/lib/prisma";

// POST /api/auth/admin/login
export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return apiError("Email et mot de passe requis");
        }

        const admin = await prisma.admin.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        if (!admin) {
            return apiError("Identifiants incorrects", 401);
        }

        const valid = await bcrypt.compare(password, admin.passwordHash);
        if (!valid) {
            return apiError("Identifiants incorrects", 401);
        }

        const token = await signToken({
            sub: admin.id,
            role: "ADMIN",
            name: admin.name,
        });

        return apiSuccess({ token, name: admin.name, role: "ADMIN" });
    } catch (err) {
        console.error("[admin/login]", err);
        return apiError("Erreur serveur", 500);
    }
}
