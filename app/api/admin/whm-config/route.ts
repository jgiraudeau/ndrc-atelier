/**
 * Routes CRUD pour la configuration WHM.
 * Réservé aux admins.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["ADMIN"])
  if (auth instanceof NextResponse) return auth

  const configs = await prisma.whmConfig.findMany({
    where: { adminId: auth.payload.sub },
    select: {
      id: true,
      label: true,
      host: true,
      port: true,
      whmUser: true,
      isActive: true,
      createdAt: true,
      // token non exposé
    },
  })

  return NextResponse.json({ configs })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["ADMIN"])
  if (auth instanceof NextResponse) return auth

  let body: { label: string; host: string; port?: number; whmUser: string; whmToken: string }
  try {
    body = await request.json()
  } catch {
    return apiError("Corps de requête invalide")
  }

  const { label, host, whmUser, whmToken, port } = body
  if (!label || !host || !whmUser || !whmToken) {
    return apiError("label, host, whmUser et whmToken sont requis")
  }

  const config = await prisma.whmConfig.create({
    data: {
      label,
      host: host.replace(/^https?:\/\//, "").split(":")[0],
      port: port ?? 2087,
      whmUser,
      whmToken,
      adminId: auth.payload.sub,
    },
    select: { id: true, label: true, host: true, isActive: true },
  })

  return NextResponse.json({ config }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ["ADMIN"])
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return apiError("id requis")

  await prisma.whmConfig.deleteMany({
    where: { id, adminId: auth.payload.sub },
  })

  return NextResponse.json({ ok: true })
}
