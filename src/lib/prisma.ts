import { PrismaClient } from "@prisma/client";

declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

// Singleton Prisma pour Next.js
// Évite de créer une nouvelle connexion à chaque hot-reload en dev
export const prisma =
    global.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });

if (process.env.NODE_ENV !== "production") {
    global.prisma = prisma;
}
