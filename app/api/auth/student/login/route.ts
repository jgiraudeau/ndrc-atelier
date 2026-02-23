import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { signToken } from "@/src/lib/jwt";
import { apiError, apiSuccess } from "@/src/lib/api-helpers";

// POST /api/auth/student/login
export async function POST(request: NextRequest) {
    try {
        const { identifier, password } = await request.json();

        if (!identifier || !password) {
            return apiError("Identifiant et mot de passe requis");
        }

        const student = await prisma.student.findUnique({
            where: { identifier: identifier.toLowerCase().trim() },
            include: { class: true },
        });

        if (!student) {
            return apiError("Identifiant ou mot de passe incorrect", 401);
        }

        const valid = await bcrypt.compare(password, student.passwordHash);
        if (!valid) {
            return apiError("Identifiant ou mot de passe incorrect", 401);
        }

        const token = await signToken({
            sub: student.id,
            role: "STUDENT",
            name: `${student.firstName} ${student.lastName}`,
            classCode: student.class.code,
        });

        return apiSuccess({
            token,
            name: `${student.firstName} ${student.lastName}`,
            role: "STUDENT",
            classCode: student.class.code,
            studentId: student.id,
        });
    } catch (err) {
        console.error("[student/login]", err);
        return apiError("Erreur serveur", 500);
    }
}
