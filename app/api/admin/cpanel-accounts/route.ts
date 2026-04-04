/**
 * GET   /api/admin/cpanel-accounts  — Liste les comptes cPanel en DB
 * POST  /api/admin/cpanel-accounts  — Crée un nouveau compte cPanel via WHM
 * PATCH /api/admin/cpanel-accounts  — Met à jour le token cPanel d'un compte
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"
import { createCpanelAccount, generatePassword, type WhmClientConfig } from "@/src/lib/whm-service"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["ADMIN"])
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const whmConfigId = searchParams.get("whmConfigId")

  const accounts = await prisma.cpanelAccount.findMany({
    where: {
      whmConfig: { adminId: auth.payload.sub },
      ...(whmConfigId ? { whmConfigId } : {}),
    },
    include: {
      whmConfig: { select: { label: true, host: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ accounts })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["ADMIN"])
  if (auth instanceof NextResponse) return auth

  let body: { whmConfigId: string; username: string; domain: string; password?: string; cpanelToken?: string; plan?: string; skipWhmCreate?: boolean }
  try { body = await request.json() } catch { return apiError("Corps invalide") }

  const { whmConfigId, username, plan, skipWhmCreate } = body
  // Nettoyer le domaine : supprimer http(s):// et slash final
  const domain = body.domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
  if (!whmConfigId || !username || !domain) {
    return apiError("whmConfigId, username et domain sont requis")
  }

  const whmConfig = await prisma.whmConfig.findFirst({
    where: { id: whmConfigId, adminId: auth.payload.sub, isActive: true },
  })
  if (!whmConfig) return apiError("Config WHM introuvable", 404)

  const password = body.password || generatePassword(14)
  const cpanelToken = body.cpanelToken || null

  if (!skipWhmCreate) {
    const clientConfig: WhmClientConfig = {
      host: `https://${whmConfig.host}:${whmConfig.port}`,
      user: whmConfig.whmUser,
      token: whmConfig.whmToken,
    }
    const result = await createCpanelAccount(clientConfig, { user: username, domain, password, email: `${username}@${domain}`, plan })
    const success = result?.metadata?.result === 1 || result?.data?.result === 1
    if (!success) {
      const reason = result?.metadata?.reason || result?.data?.reason || "Erreur WHM inconnue"
      return apiError(`WHM : ${reason}`, 400)
    }
  }

  // Stocker en DB (upsert pour l'import)
  const account = await prisma.cpanelAccount.upsert({
    where: { username_whmConfigId: { username, whmConfigId } },
    create: { username, domain, password, cpanelToken, plan: plan || "default", whmConfigId },
    update: { domain, plan: plan || "default", ...(cpanelToken !== null ? { cpanelToken } : {}) },
    select: { id: true, username: true, domain: true, plan: true, status: true, cpanelToken: true, createdAt: true },
  })

  return NextResponse.json({ account, password }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request, ["ADMIN"])
  if (auth instanceof NextResponse) return auth

  let body: { id: string; cpanelToken?: string; domain?: string }
  try { body = await request.json() } catch { return apiError("Corps invalide") }
  const { id, cpanelToken } = body
  const domain = body.domain ? body.domain.replace(/^https?:\/\//, "").replace(/\/$/, "") : undefined
  if (!id) return apiError("id requis")

  const existing = await prisma.cpanelAccount.findFirst({
    where: { id, whmConfig: { adminId: auth.payload.sub } },
  })
  if (!existing) return apiError("Compte introuvable", 404)

  const account = await prisma.cpanelAccount.update({
    where: { id },
    data: {
      ...(cpanelToken !== undefined ? { cpanelToken: cpanelToken || null } : {}),
      ...(domain !== undefined ? { domain } : {}),
    },
    select: { id: true, username: true, domain: true, cpanelToken: true },
  })

  return NextResponse.json({ account })
}
