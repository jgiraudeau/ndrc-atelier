/**
 * GET  /api/provisioning/sites?cpanelUser=xxx
 * PATCH /api/provisioning/sites — { siteId, studentId } affecter un site à un élève
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const cpanelUser = request.nextUrl.searchParams.get("cpanelUser")
  if (!cpanelUser) return apiError("cpanelUser requis")

  const sites = await prisma.site.findMany({
    where: { cpanelUser },
    include: { student: { select: { id: true, firstName: true, lastName: true, identifier: true } } },
    orderBy: [{ type: "asc" }, { subdomain: "asc" }],
  })

  return NextResponse.json({ sites })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const body = await request.json() as { siteId: string; studentId: string | null }
  const { siteId, studentId } = body
  if (!siteId) return apiError("siteId requis")

  const site = await prisma.site.update({
    where: { id: siteId },
    data: { studentId: studentId ?? null },
    include: { student: { select: { id: true, firstName: true, lastName: true, identifier: true } } },
  })

  // Mettre à jour aussi wpUrl / prestaUrl sur l'étudiant
  if (studentId && site.url) {
    if (site.type === "WORDPRESS") {
      await prisma.student.update({ where: { id: studentId }, data: { wpUrl: site.url } })
    } else if (site.type === "PRESTASHOP") {
      await prisma.student.update({ where: { id: studentId }, data: { prestaUrl: site.url } })
    }
  }

  return NextResponse.json({ site })
}
