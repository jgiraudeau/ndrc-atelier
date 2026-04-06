/**
 * GET /api/teacher/students?classId=xxx
 * Retourne les élèves d'une classe appartenant au formateur connecté.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const classId = request.nextUrl.searchParams.get("classId")
  if (!classId) return apiError("classId requis")

  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true, firstName: true, lastName: true, identifier: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  return NextResponse.json({ students })
}
