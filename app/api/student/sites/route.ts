/**
 * GET /api/student/sites
 * Retourne les sites (WP + PS) de l'élève connecté.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["STUDENT"])
  if (auth instanceof NextResponse) return auth

  const sites = await prisma.site.findMany({
    where: { studentId: auth.payload.sub },
    select: {
      id: true,
      type: true,
      url: true,
      adminUrl: true,
      adminUser: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json({ sites })
}
