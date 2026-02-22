import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractToken, JWTPayload } from "@/src/lib/jwt";

/**
 * Vérifie le token JWT et retourne le payload ou une erreur 401
 */
export async function requireAuth(
    request: NextRequest,
    allowedRoles?: Array<"TEACHER" | "STUDENT" | "ADMIN">
): Promise<{ payload: JWTPayload } | NextResponse> {
    const token = extractToken(request);

    if (!token) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
        return NextResponse.json({ error: "Token invalide ou expiré" }, { status: 401 });
    }

    if (allowedRoles && !allowedRoles.includes(payload.role)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return { payload };
}

export function apiError(message: string, status = 400) {
    return NextResponse.json({ error: message }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
    return NextResponse.json(data, { status });
}
