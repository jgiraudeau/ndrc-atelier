import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { signToken } from "@/src/lib/jwt";
import { apiError, apiSuccess } from "@/src/lib/api-helpers";

// POST /api/auth/admin/login
export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return apiError("Email et mot de passe requis");
        }

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            return apiError("Configuration admin manquante", 500);
        }

        if (email.toLowerCase().trim() !== adminEmail.toLowerCase()) {
            return apiError("Identifiants incorrects", 401);
        }

        if (password !== adminPassword) {
            return apiError("Identifiants incorrects", 401);
        }

        const token = await signToken({
            sub: "admin",
            role: "ADMIN",
            name: "Administrateur",
        });

        return apiSuccess({ token, name: "Administrateur", role: "ADMIN" });
    } catch (err) {
        console.error("[admin/login]", err);
        return apiError("Erreur serveur", 500);
    }
}
