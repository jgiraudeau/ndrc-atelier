/**
 * GET /api/admin/cpanel-accounts/whm-list?whmConfigId=xxx
 * Liste les comptes cPanel directement depuis WHM (en live)
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"
import { listAccounts, type WhmClientConfig } from "@/src/lib/whm-service"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["ADMIN"])
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const whmConfigId = searchParams.get("whmConfigId")
  if (!whmConfigId) return apiError("whmConfigId requis")

  const whmConfig = await prisma.whmConfig.findFirst({
    where: { id: whmConfigId, adminId: auth.payload.sub, isActive: true },
  })
  if (!whmConfig) return apiError("Config WHM introuvable", 404)

  const clientConfig: WhmClientConfig = {
    host: `https://${whmConfig.host}:${whmConfig.port}`,
    user: whmConfig.whmUser,
    token: whmConfig.whmToken,
  }

  const accounts = await listAccounts(clientConfig)
  return NextResponse.json({ accounts })
}
