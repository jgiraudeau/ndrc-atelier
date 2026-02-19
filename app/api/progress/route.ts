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
            proof: p.proof,
            updatedAt: p.updatedAt.toISOString(),
        }))
    );
}

// POST /api/progress — valider ou invalider une compétence
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request, ["STUDENT"]);
    if ("status" in auth) return auth;
    const studentId = auth.payload.sub;

    try {
        const { competencyId, acquired, proof } = await request.json();

        if (!competencyId || typeof acquired !== "boolean") {
            return apiError("competencyId et acquired (boolean) requis");
        }

        const record = await prisma.progress.upsert({
            where: { studentId_competencyId: { studentId, competencyId } },
            create: { studentId, competencyId, acquired, proof: proof || null },
            update: { acquired, proof: proof || null },
        });

        return apiSuccess({
            competencyId: record.competencyId,
            acquired: record.acquired,
            proof: record.proof,
            updatedAt: record.updatedAt.toISOString(),
        });
    } catch (err) {
        console.error("[progress/POST]", err);
        return apiError("Erreur serveur", 500);
    }
}
