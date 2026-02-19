import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "fallback-dev-secret-CHANGE-IN-PRODUCTION"
);

export type JWTPayload = {
    sub: string;       // ID de l'utilisateur (teacher ou student)
    role: "TEACHER" | "STUDENT";
    name: string;
    classCode?: string; // Pour les élèves uniquement
    exp?: number;
};

/**
 * Crée un JWT signé valable 7 jours
 */
export async function signToken(payload: Omit<JWTPayload, "exp">): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(SECRET);
}

/**
 * Vérifie et décode un JWT
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload as unknown as JWTPayload;
    } catch {
        return null;
    }
}

/**
 * Extrait le token depuis les headers de la requête (Authorization: Bearer ...)
 */
export function extractToken(request: Request): string | null {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    return authHeader.slice(7);
}
