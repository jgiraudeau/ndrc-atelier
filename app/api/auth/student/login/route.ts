import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { signToken } from "@/src/lib/jwt";
import { apiError, apiSuccess } from "@/src/lib/api-helpers";

// POST /api/auth/student/login
export async function POST(request: NextRequest) {
    try {
        const { classCode, pin } = await request.json();

        if (!classCode || !pin) {
            return apiError("Code classe et PIN requis");
        }

        // Trouver la classe par son code
        const cls = await prisma.class.findFirst({
            where: { code: classCode.toUpperCase().trim() },
        });

        if (!cls) {
            return apiError("Code classe non reconnu", 401);
        }

        // Récupérer les élèves de cette classe
        const students = await prisma.student.findMany({
            where: { classId: cls.id },
        });

        // Vérifier le PIN (hashé avec bcrypt) pour chaque élève
        let matchedStudent = null;
        for (const student of students) {
            const valid = await bcrypt.compare(pin, student.pinHash);
            if (valid) {
                matchedStudent = student;
                break;
            }
        }

        if (!matchedStudent) {
            return apiError("PIN incorrect", 401);
        }

        const token = await signToken({
            sub: matchedStudent.id,
            role: "STUDENT",
            name: `${matchedStudent.firstName} ${matchedStudent.lastName}`,
            classCode: cls.code,
        });

        return apiSuccess({
            token,
            name: `${matchedStudent.firstName} ${matchedStudent.lastName}`,
            role: "STUDENT",
            classCode: cls.code,
            studentId: matchedStudent.id,
        });
    } catch (err) {
        console.error("[student/login]", err);
        return apiError("Erreur serveur", 500);
    }
}
