/**
 * GET  /api/admin/classes         — Liste toutes les classes
 * PATCH /api/admin/classes        — Assigne un compte cPanel à une classe
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["ADMIN"])
  if (auth instanceof NextResponse) return auth

  const classes = await prisma.class.findMany({
    include: {
      teacher: { select: { name: true, email: true } },
      _count: { select: { students: true } },
    },
    orderBy: [{ teacher: { name: "asc" } }, { name: "asc" }],
  })

  return NextResponse.json({ classes })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request, ["ADMIN"])
  if (auth instanceof NextResponse) return auth

  let body: { classId: string; cpanelUser: string | null }
  try { body = await request.json() } catch { return apiError("Corps invalide") }

  const { classId, cpanelUser } = body
  if (!classId) return apiError("classId requis")

  const updated = await prisma.class.update({
    where: { id: classId },
    data: { cpanelUser: cpanelUser || null },
    select: { id: true, name: true, code: true, cpanelUser: true },
  })

  return NextResponse.json({ class: updated })
}
