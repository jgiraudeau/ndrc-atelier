import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";

// GET /api/progress — progression de l'élève connecté
export async function GET(request: NextRequest) {
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
        const { competencyId, acquired, status, proof } = await request.json();

        if (!competencyId || typeof acquired !== "boolean" || typeof status !== "number") {
            return apiError("competencyId, acquired (boolean), et status (number) requis");
        }

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
