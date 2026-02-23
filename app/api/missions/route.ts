import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";

// POST /api/missions — Sauvegarder une mission
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request, ["TEACHER", "STUDENT"]);
    if ("status" in auth) return auth;

    try {
        const { title, content, platform, level, competencyIds } = await request.json();

        if (!title || !content || !platform) {
            return apiError("title, content et platform sont requis");
        }

        const mission = await prisma.mission.create({
            data: {
                title,
                content,
                platform,
                level: level || 2,
                competencyIds: competencyIds || [],
                createdBy: auth.payload.sub,
                createdByRole: auth.payload.role,
            },
        });

        return apiSuccess(mission);
    } catch (err) {
        console.error("[missions POST]", err);
        return apiError("Erreur serveur", 500);
    }
}

// GET /api/missions — Lister les missions du formateur
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request, ["TEACHER"]);
    if ("status" in auth) return auth;

    try {
        const { searchParams } = new URL(request.url);
        const platform = searchParams.get("platform");

        const missions = await prisma.mission.findMany({
            where: {
                createdBy: auth.payload.sub,
                ...(platform ? { platform } : {}),
            },
            include: {
                _count: { select: { assignments: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return apiSuccess(missions);
    } catch (err) {
        console.error("[missions GET]", err);
        return apiError("Erreur serveur", 500);
    }
}
