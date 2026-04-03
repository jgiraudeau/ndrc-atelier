/**
 * Script de seed — Crée le compte Admin initial
 * Usage : npx tsx scripts/seed-admin.ts
 *
 * Lit ADMIN_EMAIL et ADMIN_PASSWORD depuis .env.local
 */

import { config } from "dotenv"
import { resolve } from "path"

// Charger .env.local
config({ path: resolve(process.cwd(), ".env.local") })

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error("❌ DATABASE_PUBLIC_URL ou DATABASE_URL manquant dans .env.local")
  process.exit(1)
}

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
if (!email || !password) {
  console.error("❌ ADMIN_EMAIL et ADMIN_PASSWORD sont requis dans .env.local")
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

async function main() {
  console.log(`\n🔧 Création du compte admin : ${email}`)

  const existing = await prisma.admin.findUnique({ where: { email } })
  if (existing) {
    console.log("✅ Compte admin déjà existant — rien à faire.")
    return
  }

  const passwordHash = await bcrypt.hash(password!, 12)
  const admin = await prisma.admin.create({
    data: {
      email: email!,
      passwordHash,
      name: "Administrateur",
    },
  })

  console.log(`✅ Admin créé avec succès !`)
  console.log(`   ID    : ${admin.id}`)
  console.log(`   Email : ${admin.email}`)
  console.log(`   Pass  : ${password} (à changer en prod)\n`)
}

main()
  .catch((err) => {
    console.error("❌ Erreur :", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
