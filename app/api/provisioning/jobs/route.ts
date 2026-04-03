/**
 * POST /api/provisioning/jobs
 * Crée un job de provisioning pour une classe et un type de site.
 * Réservé aux formateurs (TEACHER) et admins (ADMIN).
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"
import { SiteType } from "@prisma/client"

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  let body: { classId: string; siteType: string; whmConfigId: string }
  try {
    body = await request.json()
  } catch {
    return apiError("Corps de requête invalide")
  }

  const { classId, siteType, whmConfigId } = body

  if (!classId || !siteType || !whmConfigId) {
    return apiError("classId, siteType et whmConfigId sont requis")
  }

  if (!["WORDPRESS", "PRESTASHOP"].includes(siteType)) {
    return apiError("siteType doit être WORDPRESS ou PRESTASHOP")
  }

  // Vérifier que la classe appartient au formateur
  const cls = await prisma.class.findFirst({
    where: {
      id: classId,
      ...(auth.payload.role === "TEACHER" ? { teacherId: auth.payload.sub } : {}),
    },
    include: { students: true },
  })

  if (!cls) return apiError("Classe introuvable ou accès refusé", 404)
  if (cls.students.length === 0) return apiError("Cette classe n'a pas d'élèves", 400)

  // Vérifier que la config WHM existe et est active
  const whmConfig = await prisma.whmConfig.findFirst({
    where: { id: whmConfigId, isActive: true },
  })
  if (!whmConfig) return apiError("Configuration WHM introuvable", 404)

  const job = await prisma.provisioningJob.create({
    data: {
      siteType: siteType as SiteType,
      classId,
      teacherId: auth.payload.role === "TEACHER" ? auth.payload.sub : cls.teacherId,
      whmConfigId,
      log: [],
    },
  })

  return NextResponse.json({ job }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const jobs = await prisma.provisioningJob.findMany({
    where: auth.payload.role === "TEACHER" ? { teacherId: auth.payload.sub } : {},
    include: {
      class: { select: { name: true, code: true } },
      sites: { select: { id: true, status: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json({ jobs })
}
