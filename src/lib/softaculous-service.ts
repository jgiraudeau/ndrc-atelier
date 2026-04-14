/**
 * Softaculous Service — ndrc-atelier
 * Même approche que whm-manager : session WHM → cookie cPanel → Softaculous.
 * Pas de token cPanel direct (bloqué sur Softaculous par o2switch).
 */

import { getCPanelSessionData, cpanelApi, type WhmClientConfig } from "@/src/lib/whm-service"

const SOFTACULOUS_APPS: Record<string, { id: number; name: string }> = {
  wordpress: { id: 26, name: "WordPress" },
  prestashop: { id: 29, name: "PrestaShop" },
}

export type SoftAppType = "wordpress" | "prestashop"

function parseMaybeJson(input: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(input) as unknown
    if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>
  } catch {
    // ignore
  }
  return null
}

function extractSoftError(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null
  const root = data as Record<string, unknown>
  const val = root.error ?? root.errors ?? (root.data as Record<string, unknown> | undefined)?.error
  if (typeof val === "string") return val.trim() || null
  if (Array.isArray(val) && val.length > 0) return String(val[0])
  return null
}

export interface ProvisionResult {
  success: boolean
  siteUrl?: string
  adminUrl?: string
  adminUser?: string
  adminPass?: string
  error?: string
}

/**
 * Crée un sous-domaine cPanel via WHM (relay UAPI) — même approche que whm-manager.
 */
export async function createSubdomain(
  whmConfig: WhmClientConfig,
  cpanelUser: string,
  subdomain: string,
  rootDomain: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await cpanelApi(whmConfig, cpanelUser, "SubDomain", "addsubdomain", {
      domain: subdomain,
      rootdomain: rootDomain,
      dir: `public_html/${subdomain}`,
    })

    const errors: string[] = Array.isArray(data?.errors) ? data.errors as string[] : []
    const alreadyExists = errors.some((e) => e.toLowerCase().includes("exist"))
    if (alreadyExists) return { success: true }

    if (data?.metadata?.result === 0 || errors.length > 0) {
      return { success: false, error: errors.join(", ") || "Erreur création sous-domaine" }
    }

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Installe WP ou PS via session WHM → Softaculous — même approche que whm-manager.
 */
export async function installApp(
  whmConfig: WhmClientConfig,
  cpanelUser: string,
  app: SoftAppType,
  options: {
    targetDomain: string   // ex: "wp1.sully.ltpsully.o2switch.site"
    adminEmail: string
    siteName: string
    adminUser: string
    adminPass: string
  },
): Promise<ProvisionResult> {
  const appConfig = SOFTACULOUS_APPS[app]
  if (!appConfig) return { success: false, error: `App inconnue : ${app}` }

  let baseUrl: string
  let cookie: string

  try {
    const session = await getCPanelSessionData(whmConfig, cpanelUser)
    baseUrl = `https://${session.host}:2083/${session.cpsess}`
    cookie = session.cookie
  } catch (err: unknown) {
    return { success: false, error: `Session cPanel : ${err instanceof Error ? err.message : String(err)}` }
  }

  const softaUrl = `${baseUrl}/frontend/jupiter/softaculous/index.live.php?act=software&soft=${appConfig.id}&api=json`

  // Récupérer le formulaire d'installation pour extraire soft_status_key (token CSRF Softaculous)
  let softStatusKey = ""
  try {
    const formRes = await fetch(
      `${baseUrl}/frontend/jupiter/softaculous/index.live.php?act=software&soft=${appConfig.id}`,
      { headers: { Cookie: cookie } }
    )
    const formHtml = await formRes.text()
    const match = formHtml.match(/<input\b[^>]*\bname=["']soft_status_key["'][^>]*>/i)
    if (match) {
      const valMatch = match[0].match(/\bvalue=["']([^"']*)["']/i)
      softStatusKey = valMatch?.[1] ?? ""
    }
  } catch { /* continue sans le token — Softaculous retournera une erreur explicite */ }

  const installParams = new URLSearchParams({
    softsubmit: "1",
    auto_upgrade: "1",
    protocol: "https://",
    domain: options.targetDomain,
    in_dir: "",
    admin_username: options.adminUser,
    admin_pass: options.adminPass,
    admin_email: options.adminEmail,
    language: "fr",
    site_name: options.siteName,
    ...(softStatusKey ? { soft_status_key: softStatusKey } : {}),
  })

  try {
    const res = await fetch(softaUrl, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: installParams.toString(),
    })

    const text = await res.text()
    const parsed = parseMaybeJson(text)
    const softError = extractSoftError(parsed)

    if (softError) return { success: false, error: softError }
    if (!res.ok) return { success: false, error: `Softaculous HTTP ${res.status}` }

    const siteUrl = `https://${options.targetDomain}`
    // WP : /wp-admin toujours fixe. PS : /adminXXXXXX aléatoire, la réponse Softaculous contient l'URL
    let adminUrl: string | undefined = app === "wordpress" ? `${siteUrl}/wp-admin` : undefined
    if (app === "prestashop" && parsed) {
      const data = parsed.data as Record<string, unknown> | undefined
      const softAdminUrl = data?.admin_url ?? parsed.admin_url
      if (typeof softAdminUrl === "string" && softAdminUrl) {
        adminUrl = (softAdminUrl.startsWith("http") ? softAdminUrl : `${siteUrl}/${softAdminUrl.replace(/^\//, "")}`) || undefined
      }
    }

    return {
      success: true,
      siteUrl,
      adminUrl,
      adminUser: options.adminUser,
      adminPass: options.adminPass,
    }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
