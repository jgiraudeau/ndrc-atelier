/**
 * GET /api/provisioning/cpanel-url?cpanelUser=xxx
 * Génère une URL de session cPanel auto-login via WHM.
 * L'URL est valide ~15 minutes, usage unique.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"
import { getCPanelSessionData } from "@/src/lib/whm-service"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const cpanelUser = request.nextUrl.searchParams.get("cpanelUser")
  if (!cpanelUser) return apiError("cpanelUser requis")

  const config = await prisma.whmConfig.findFirst({ where: { isActive: true } })
  if (!config) return apiError("Aucune config WHM active")

  const whmConfig = {
    host: `https://${config.host}:${config.port}`,
    user: config.whmUser,
    token: config.whmToken,
  }

  try {
    const session = await getCPanelSessionData(whmConfig, cpanelUser)
    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Impossible de créer la session cPanel")
  }
}
