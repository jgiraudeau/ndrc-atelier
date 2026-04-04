/**
 * GET /api/teacher/classes
 * Retourne les classes du formateur connecté avec le nombre d'élèves.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const classes = await prisma.class.findMany({
    where: { teacherId: auth.payload.sub },
    include: { students: { select: { id: true } } },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ classes })
}
