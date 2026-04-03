import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const configs = await prisma.whmConfig.findMany({
    where: { isActive: true },
    select: {
      id: true,
      label: true,
      host: true,
    },
  })

  return NextResponse.json({ configs })
}
