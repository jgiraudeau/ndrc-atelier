/**
 * Script de seed — Ajoute la config WHM o2switch
 * Usage : npx tsx scripts/seed-whm.ts
 */

import { config } from "dotenv"
import { resolve } from "path"
config({ path: resolve(process.cwd(), ".env.local") })

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
if (!connectionString) { console.error("❌ DATABASE_PUBLIC_URL manquant"); process.exit(1) }

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

async function main() {
  // Récupérer le premier admin
  const admin = await prisma.admin.findFirst()
  if (!admin) { console.error("❌ Aucun admin en base — lance seed-admin.ts d'abord"); process.exit(1) }

  // Vérifier si la config existe déjà
  const existing = await prisma.whmConfig.findFirst({
    where: { host: "campus01.o2switch.net" }
  })
  if (existing) {
    console.log("✅ Config WHM déjà existante — rien à faire.")
    return
  }

  const whm = await prisma.whmConfig.create({
    data: {
      label: "O2 switch",
      host: "campus01.o2switch.net",
      port: 2087,
      whmUser: "LTPSULLY",
      whmToken: "0TLXXETI1VWJ8A6G9DXJGOAOC2YQKQ66",
      isActive: true,
      adminId: admin.id,
    }
  })

  console.log(`✅ Config WHM créée !`)
  console.log(`   ID    : ${whm.id}`)
  console.log(`   Hôte  : ${whm.host}:${whm.port}`)
  console.log(`   User  : ${whm.whmUser}`)
}

main()
  .catch(e => { console.error("❌ Erreur :", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
