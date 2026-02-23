import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";
import bcrypt from "bcryptjs";

// GET /api/students
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request, ["TEACHER"]);
    if ("status" in auth) return auth;

    try {
        const students = await prisma.student.findMany({
            where: { teacherId: auth.payload.sub },
            include: {
                class: true,
                progress: true,
                comments: {
                    include: { teacher: true },
                    orderBy: { createdAt: "desc" },
                },
            },
            orderBy: [{ class: { code: "asc" } }, { lastName: "asc" }],
        });

        const safeStudents = students.map((s: any) => {
            const acquiredCount = s.progress.filter((p: any) => p.acquired).length;

            let lastActive = null;
            if (s.progress.length > 0) {
                const sortedProgress = [...s.progress].sort((a: any, b: any) =>
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                );
                lastActive = sortedProgress[0].updatedAt.toISOString();
            }

            return {
                id: s.id,
                firstName: s.firstName,
                lastName: s.lastName,
                identifier: s.identifier,
                classCode: s.class.code,
                className: s.class.name,
                wpUrl: s.wpUrl,
                prestaUrl: s.prestaUrl,
                acquiredCount: acquiredCount,
                progress: 0,
                lastActive: lastActive,
                competencies: s.progress.map((p: any) => ({
                    competencyId: p.competencyId,
                    acquired: p.acquired,
                    status: p.status,
                    proof: p.proof,
                    updatedAt: p.updatedAt.toISOString(),
                })),
                comments: s.comments.map((c: any) => ({
                    id: c.id,
                    text: c.text,
                    authorName: c.teacher?.name || "Professeur",
                    date: c.createdAt.toISOString(),
                })),
            };
        });

        return apiSuccess(safeStudents);
    } catch (error) {
        console.error("[GET /api/students] Error:", error);
        return apiError("Erreur serveur lors de la récupération des élèves", 500);
    }
}

function normalizeStr(s: string): string {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

async function generateUniqueIdentifier(firstName: string, lastName: string): Promise<string> {
    const base = `${normalizeStr(firstName)}.${normalizeStr(lastName)}`;
    let identifier = base;
    let counter = 2;

    while (true) {
        const existing = await prisma.student.findUnique({ where: { identifier } });
        if (!existing) return identifier;
        identifier = `${base}${counter}`;
        counter++;
    }
}

// POST /api/students (Import CSV)
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request, ["TEACHER"]);
    if ("status" in auth) return auth;

    try {
        const body = await request.json();
        const { students } = body; // Array of { firstName, lastName, classCode, password }

        if (!Array.isArray(students) || students.length === 0) {
            return apiError("Format invalide. Un tableau 'students' est attendu.", 400);
        }

        let createdCount = 0;
        let updatedCount = 0;
        const createdStudents: Array<{ firstName: string; lastName: string; identifier: string }> = [];

        for (const s of students) {
            if (!s.firstName || !s.lastName || !s.classCode || !s.password) continue;

            // 1. Upsert Class
            const classRecord = await prisma.class.upsert({
                where: {
                    code_teacherId: {
                        code: s.classCode.toUpperCase(),
                        teacherId: auth.payload.sub,
                    },
                },
                update: {},
                create: {
                    code: s.classCode.toUpperCase(),
                    name: s.classCode.toUpperCase(),
                    teacherId: auth.payload.sub,
                },
            });

            // 2. Hash password
            const passwordHash = await bcrypt.hash(s.password, 10);

            // 3. Chercher si l'élève existe déjà
            const existingStudent = await prisma.student.findFirst({
                where: {
                    firstName: { equals: s.firstName, mode: "insensitive" },
                    lastName: { equals: s.lastName, mode: "insensitive" },
                    classId: classRecord.id,
                },
            });

            if (existingStudent) {
                await prisma.student.update({
                    where: { id: existingStudent.id },
                    data: { passwordHash },
                });
                updatedCount++;
            } else {
                const identifier = await generateUniqueIdentifier(s.firstName, s.lastName);
                await prisma.student.create({
                    data: {
                        firstName: s.firstName,
                        lastName: s.lastName,
                        identifier,
                        passwordHash,
                        classId: classRecord.id,
                        teacherId: auth.payload.sub,
                    },
                });
                createdCount++;
                createdStudents.push({ firstName: s.firstName, lastName: s.lastName, identifier });
            }
        }

        return apiSuccess({
            message: "Import terminé avec succès",
            stats: { created: createdCount, updated: updatedCount },
            createdStudents,
        });

    } catch (error) {
        console.error("[POST /api/students] Error:", error);
        return apiError("Erreur lors de l'import", 500);
    }
}
