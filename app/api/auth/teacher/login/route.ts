import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { signToken } from "@/src/lib/jwt";
import { apiError, apiSuccess } from "@/src/lib/api-helpers";

// POST /api/auth/teacher/login
export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return apiError("Email et mot de passe requis");
        }

        const teacher = await prisma.teacher.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        if (!teacher) {
            return apiError("Identifiants incorrects", 401);
        }

        const valid = await bcrypt.compare(password, teacher.passwordHash);
        if (!valid) {
            return apiError("Identifiants incorrects", 401);
        }

        const token = await signToken({
            sub: teacher.id,
            role: "TEACHER",
            name: teacher.name,
        });

        return apiSuccess({ token, name: teacher.name, role: "TEACHER" });
    } catch (err) {
        console.error("[teacher/login]", err);
        return apiError("Erreur serveur", 500);
    }
}
