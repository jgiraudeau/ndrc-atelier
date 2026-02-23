/**
 * Script de migration :
 * - Copie pinHash → passwordHash pour les élèves existants
 * - Génère un identifiant unique (prenom.nom) pour chaque élève
 *
 * Usage : npx tsx scripts/migrate-students.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!connectionString) {
    console.error("DATABASE_URL ou DATABASE_PUBLIC_URL requis");
    process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter } as any);

function normalizeStr(s: string): string {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

async function main() {
    const students = await prisma.student.findMany();
    console.log(`Found ${students.length} students to migrate`);

    const usedIdentifiers = new Set<string>();

    for (const student of students) {
        // Générer identifiant
        const base = `${normalizeStr(student.firstName)}.${normalizeStr(student.lastName)}`;
        let identifier = base;
        let counter = 2;
        while (usedIdentifiers.has(identifier)) {
            identifier = `${base}${counter}`;
            counter++;
        }
        usedIdentifiers.add(identifier);

        // Copier pinHash → passwordHash si nécessaire
        const passwordHash = student.passwordHash || (student as any).pinHash || "";

        await prisma.student.update({
            where: { id: student.id },
            data: { identifier, passwordHash },
        });

        console.log(`  ✓ ${student.firstName} ${student.lastName} → ${identifier}`);
    }

    console.log("Migration terminée !");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
