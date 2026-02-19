import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";

// GET /api/students — liste des élèves du formateur connecté (avec progression)
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request, ["TEACHER"]);
    if ("status" in auth) return auth;
    const teacherId = auth.payload.sub;

    const students = await prisma.student.findMany({
        where: { teacherId },
        include: {
            class: true,
            progress: true,
            comments: {
                orderBy: { createdAt: "desc" },
                include: { teacher: { select: { name: true } } },
            },
        },
        orderBy: [{ class: { code: "asc" } }, { lastName: "asc" }],
    });

    const result = students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        classCode: s.class.code,
        className: s.class.name,
        acquiredCount: s.progress.filter((p) => p.acquired).length,
        progress: 0, // calculé côté client avec TOTAL_COMPETENCIES
        lastActive: s.progress.length > 0
            ? s.progress.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0].updatedAt.toISOString()
            : null,
        competencies: s.progress.map((p) => ({
            competencyId: p.competencyId,
            acquired: p.acquired,
            proof: p.proof,
            updatedAt: p.updatedAt.toISOString(),
        })),
        comments: s.comments.map((c) => ({
            id: c.id,
            text: c.text,
            authorName: c.teacher.name,
            date: c.createdAt.toISOString(),
        })),
    }));

    return apiSuccess(result);
}

// POST /api/students — import CSV (bulk)
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request, ["TEACHER"]);
    if ("status" in auth) return auth;
    const teacherId = auth.payload.sub;

    try {
        const { students } = await request.json();
        // students: Array<{ firstName, lastName, classCode, pin }>

        if (!Array.isArray(students) || students.length === 0) {
            return apiError("Liste d'élèves invalide");
        }

        let imported = 0;
        const errors: string[] = [];

        for (const s of students) {
            const { firstName, lastName, classCode, pin } = s;
            if (!firstName || !lastName || !classCode || !pin) {
                errors.push(`Données manquantes pour ${firstName} ${lastName}`);
                continue;
            }

            // Trouver ou créer la classe
            const cls = await prisma.class.upsert({
                where: { code_teacherId: { code: classCode.toUpperCase(), teacherId } },
                create: { code: classCode.toUpperCase(), name: classCode.toUpperCase(), teacherId },
                update: {},
            });

            // Hasher le PIN
            const pinHash = await bcrypt.hash(pin, 10);

            // Créer l'élève (skip si doublon)
            try {
                await prisma.student.upsert({
                    where: {
                        classId_firstName_lastName: {
                            classId: cls.id,
                            firstName: firstName.trim(),
                            lastName: lastName.trim(),
                        },
                    },
                    create: {
                        firstName: firstName.trim(),
                        lastName: lastName.trim(),
                        pinHash,
                        teacherId,
                        classId: cls.id,
                    },
                    update: { pinHash }, // Met à jour le PIN si l'élève existe déjà
                });
                imported++;
            } catch {
                errors.push(`Erreur pour ${firstName} ${lastName}`);
            }
        }

        return apiSuccess({ imported, errors }, 201);
    } catch (err) {
        console.error("[students/POST]", err);
        return apiError("Erreur serveur", 500);
    }
}
