import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";
import { progressUpdateSchema } from "@/src/lib/validations";

// GET /api/progress — progression de l'élève connecté
export async function GET(request: NextRequest) {
// ... (unchanged part skipped in chunk but I must replace from start line or specific lines)
    const auth = await requireAuth(request, ["STUDENT"]);
    if ("status" in auth) return auth;
    const studentId = auth.payload.sub;

    const progress = await prisma.progress.findMany({
        where: { studentId },
    });

    return apiSuccess(
        progress.map((p: any) => ({
            competencyId: p.competencyId,
            acquired: p.acquired,
            status: p.status,
            proof: p.proof,
            updatedAt: p.updatedAt.toISOString(),
            teacherStatus: p.teacherStatus,
            teacherFeedback: p.teacherFeedback,
            teacherGradedAt: p.teacherGradedAt?.toISOString() ?? null,
        }))
    );
}

// POST /api/progress — valider ou invalider une compétence
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request, ["STUDENT"]);
    if ("status" in auth) return auth;
    const studentId = auth.payload.sub;

    try {
        const body = await request.json();
        const parseResult = progressUpdateSchema.safeParse(body);

        if (!parseResult.success) {
            return apiError("Données invalides : " + parseResult.error.issues[0].message, 400);
        }

        const { competencyId, acquired, status, proof } = parseResult.data;

        const record = await prisma.progress.upsert({
            where: { studentId_competencyId: { studentId, competencyId } },
            create: { studentId, competencyId, acquired, status, proof: proof || null },
            update: { acquired, status, proof: proof || null },
        });

        return apiSuccess({
            competencyId: record.competencyId,
            acquired: record.acquired,
            status: record.status,
            proof: record.proof,
            updatedAt: record.updatedAt.toISOString(),
        });
    } catch (err) {
        console.error("[progress/POST]", err);
        return apiError("Erreur serveur", 500);
    }
}
