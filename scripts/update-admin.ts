/**
 * Script — Met à jour le compte admin
 * Usage : npx tsx scripts/update-admin.ts
 */

import { config } from "dotenv"
import { resolve } from "path"
config({ path: resolve(process.cwd(), ".env.local") })

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
if (!connectionString) { console.error("❌ DATABASE_PUBLIC_URL manquant"); process.exit(1) }

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

async function main() {
  const email = "jacques.giraudeau@gmail.com"
  const password = "chfcarantec2026$"

  const passwordHash = await bcrypt.hash(password, 12)

  // Mettre à jour l'admin existant ou en créer un nouveau
  const admin = await prisma.admin.upsert({
    where: { email },
    update: { passwordHash, name: "Jacques Giraudeau" },
    create: { email, passwordHash, name: "Jacques Giraudeau" },
  })

  console.log(`✅ Admin mis à jour !`)
  console.log(`   Email : ${admin.email}`)
  console.log(`   ID    : ${admin.id}`)
}

main()
  .catch(e => { console.error("❌ Erreur :", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
