import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { signToken } from "@/src/lib/jwt";
import { apiError, apiSuccess } from "@/src/lib/api-helpers";

// POST /api/auth/teacher/register
// Crée le premier compte formateur (protéger avec une clé admin en prod)
export async function POST(request: NextRequest) {
    try {
        const { email, password, name } = await request.json();

        if (!email || !password || !name) {
            return apiError("Email, mot de passe et nom requis");
        }

        if (password.length < 8) {
            return apiError("Mot de passe trop court (8 caractères minimum)");
        }

        const existing = await prisma.teacher.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        if (existing) {
            return apiError("Un compte existe déjà avec cet email", 409);
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const teacher = await prisma.teacher.create({
            data: {
                email: email.toLowerCase().trim(),
                passwordHash,
                name: name.trim(),
            },
        });

        const token = await signToken({
            sub: teacher.id,
            role: "TEACHER",
            name: teacher.name,
        });

        return apiSuccess({ token, name: teacher.name, role: "TEACHER" }, 201);
    } catch (err) {
        console.error("[teacher/register]", err);
        return apiError("Erreur serveur", 500);
    }
}
