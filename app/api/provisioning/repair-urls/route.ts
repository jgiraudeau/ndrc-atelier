/**
 * POST /api/provisioning/repair-urls
 * Relit la liste Softaculous et remet à jour url + adminUrl
 * pour tous les sites ACTIVE d'un compte cPanel qui n'ont pas d'adminUrl.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"
import { getCPanelSessionData } from "@/src/lib/whm-service"

function parseMaybeJson(input: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(input) as unknown
    if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>
  } catch { /* ignore */ }
  return null
}

function extractInstallations(payload: unknown): Record<string, { softurl?: string; domain?: string; adminurl?: string }> {
  const root = payload as Record<string, unknown> | null
  if (!root) return {}
  const dataNode = root.data as Record<string, unknown> | undefined
  const candidate = dataNode?.installations ?? root.installations
  const container = candidate as Record<string, unknown> | undefined
  if (!container) return {}

  const out: Record<string, { softurl?: string; domain?: string; adminurl?: string }> = {}
  for (const [key, value] of Object.entries(container)) {
    if (typeof value === "object" && value !== null) {
      const v = value as Record<string, unknown>
      if (typeof v.softurl === "string" || typeof v.domain === "string") {
        out[key] = { softurl: v.softurl as string, domain: v.domain as string, adminurl: v.adminurl as string | undefined }
        continue
      }
      for (const [nestedId, nestedValue] of Object.entries(v)) {
        const nv = nestedValue as Record<string, unknown>
        if (typeof nv?.softurl === "string" || typeof nv?.domain === "string") {
          const compositeId = /^\d+$/.test(key) && /^\d+$/.test(nestedId) ? `${key}_${nestedId}` : nestedId
          out[compositeId] = { softurl: nv.softurl as string, domain: nv.domain as string, adminurl: nv.adminurl as string | undefined }
        }
      }
    }
  }
  return out
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["ADMIN"])
  if (auth instanceof NextResponse) return auth

  try {
    const { cpanelUser } = await request.json() as { cpanelUser: string }
    if (!cpanelUser) return apiError("cpanelUser requis")

    const whmConfig = await prisma.whmConfig.findFirst({ where: { isActive: true } })
    if (!whmConfig) return apiError("Aucune config WHM active", 500)

    const cpanelAccount = await prisma.cpanelAccount.findFirst({
      where: { username: cpanelUser },
      select: { domain: true },
    })
    if (!cpanelAccount) return apiError(`Compte cPanel "${cpanelUser}" introuvable`, 404)

    const domain = cpanelAccount.domain

    // Lire la liste complète des installations depuis Softaculous
    const session = await getCPanelSessionData(
      { host: `https://${whmConfig.host}:${whmConfig.port}`, user: whmConfig.whmUser, token: whmConfig.whmToken },
      cpanelUser
    )
    const baseUrl = `https://${session.host}:2083/${session.cpsess}`
    const cookie = session.cookie

    const listRes = await fetch(
      `${baseUrl}/frontend/jupiter/softaculous/index.live.php?act=installations&api=json`,
      { headers: { Cookie: cookie } }
    )
    const installations = extractInstallations(parseMaybeJson(await listRes.text()))

    // Construire un index hostname → { siteUrl, adminUrl }
    const installByHost: Record<string, { siteUrl: string; adminUrl: string | null }> = {}
    for (const install of Object.values(installations)) {
      const raw = (install.softurl ?? install.domain ?? "").toLowerCase()
      const host = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "")
      if (!host) continue
      const siteUrl = `https://${host}`
      let adminUrl: string | null = null
      if (install.adminurl) {
        adminUrl = install.adminurl.startsWith("http")
          ? install.adminurl
          : `${siteUrl}/${install.adminurl.replace(/^\//, "")}`
      }
      installByHost[host] = { siteUrl, adminUrl }
    }

    // Tous les sites non-modèles du compte (tous statuts)
    const sites = await prisma.site.findMany({
      where: { cpanelUser, domain, isModel: false },
    })

    let repaired = 0
    let reset = 0
    const details: { subdomain: string; found: boolean; adminUrl: string | null }[] = []

    for (const site of sites) {
      const host = `${site.subdomain}.${domain}`.toLowerCase()
      const found = installByHost[host]

      if (found) {
        // Site confirmé dans Softaculous → mettre à jour url + adminUrl
        let adminUrl = found.adminUrl
        // WP : adminUrl toujours /wp-admin (Softaculous ne le retourne pas toujours)
        if (!adminUrl && site.type === "WORDPRESS") {
          adminUrl = `https://${host}/wp-admin`
        }
        await prisma.site.update({
          where: { id: site.id },
          data: { status: "ACTIVE", url: found.siteUrl, adminUrl },
        })
        repaired++
        details.push({ subdomain: site.subdomain, found: true, adminUrl })
      } else {
        // Site PAS dans Softaculous → remettre en PENDING (non déployé)
        await prisma.site.update({
          where: { id: site.id },
          data: { status: "PENDING", url: `https://${host}`, adminUrl: null },
        })
        reset++
        details.push({ subdomain: site.subdomain, found: false, adminUrl: null })
      }
    }

    return NextResponse.json({ repaired, reset, total: sites.length, details })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[repair-urls]", msg)
    return apiError(msg, 500)
  }
}
