import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 avec driver adapter pg
// Requis car Prisma 7 utilise le moteur "client" qui nécessite un adapter explicite

function createPrismaClient() {
    // En production (Vercel/Railway), utiliser l'URL interne ; en local, l'URL publique
    const isProduction = process.env.NODE_ENV === "production";
    const connectionString = isProduction
        ? (process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || "")
        : (process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL || "");

    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    global.prisma = prisma;
}
