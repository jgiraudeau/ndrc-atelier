/**
 * GET /api/provisioning/sites?cpanelUser=xxx
 * Retourne tous les sites (sous-domaines) d'un compte cPanel.
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
    include: { student: { select: { firstName: true, lastName: true, identifier: true } } },
    orderBy: [{ type: "asc" }, { subdomain: "asc" }],
  })

  return NextResponse.json({ sites })
}
