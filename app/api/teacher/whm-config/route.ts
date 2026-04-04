/**
 * GET /api/teacher/whm-config
 * Retourne les configs WHM actives (pour le formulaire de provisioning formateur).
 * Le formateur n'a pas accès aux tokens — juste label + host pour la sélection.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const configs = await prisma.whmConfig.findMany({
    where: { isActive: true },
    select: { id: true, label: true, host: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ configs })
}
