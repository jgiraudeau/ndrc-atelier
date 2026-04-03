/**
 * Softaculous Service — ndrc-atelier
 * Installation WP / PrestaShop via l'API Softaculous cPanel.
 * Adapté depuis whm-manager.
 */

import { getCPanelSessionData, type WhmClientConfig } from "@/src/lib/whm-service"

// Script IDs Softaculous
export const SOFTACULOUS_SCRIPT_IDS = {
  wordpress: 26,
  prestashop: 25,
} as const

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetch(url, init)
    } catch (error: unknown) {
      lastError = error
      if (attempt < 3) await sleep(250 * attempt)
    }
  }
  throw new Error(`fetch failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

function extractSoftError(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null
  const root = data as Record<string, unknown>
  const errorValue = root.error ?? root.errors ?? (root.data as Record<string, unknown>)?.error
  if (typeof errorValue === "string") return errorValue.trim() || null
  return null
}

export interface SoftaculousInstallResult {
  success: boolean
  installId?: string
  siteUrl?: string
  adminUrl?: string
  error?: string
}

/**
 * Installe WordPress ou PrestaShop via Softaculous.
 * Utilise une session WHM (create_user_session) pour s'authentifier.
 */
export async function installApp(
  whmConfig: WhmClientConfig,
  cpanelUser: string,
  app: SoftAppType,
  options: {
    domain: string       // domaine/sous-domaine cible
    path?: string        // chemin dans le domaine (vide = racine)
    adminUser: string    // login admin du site
    adminPass: string    // mot de passe admin
    adminEmail: string   // email admin
    siteName: string     // titre du site
  },
): Promise<SoftaculousInstallResult> {
  const { host, cpsess, cookie } = await getCPanelSessionData(whmConfig, cpanelUser)
  const baseUrl = `https://${host}:2083/${cpsess}`
  const scriptId = SOFTACULOUS_SCRIPT_IDS[app]

  const params = new URLSearchParams({
    act: "install",
    api: "json",
    softdomain: options.domain,
    softdirectory: options.path ?? "",
    admin_username: options.adminUser,
    admin_pass: options.adminPass,
    admin_email: options.adminEmail,
    site_name: options.siteName,
    overwrite_existing: "0",
  })

  const url = `${baseUrl}/frontend/jupiter/softaculous/index.live.php?softid=${scriptId}&${params.toString()}`
  const res = await fetchWithRetry(url, { headers: { Cookie: cookie } })
  const text = await res.text()
  const parsed = parseMaybeJson(text)

  const softError = extractSoftError(parsed)
  if (softError) {
    return { success: false, error: softError }
  }

  if (!res.ok) {
    return { success: false, error: `HTTP ${res.status}` }
  }

  // Récupérer l'ID d'installation depuis la réponse
  const installId = typeof parsed?.insid === "string"
    ? parsed.insid
    : typeof parsed?.data === "object" && parsed?.data !== null
      ? String((parsed.data as Record<string, unknown>).insid ?? "")
      : ""

  const siteUrl = `https://${options.domain}${options.path ? `/${options.path}` : ""}`
  const adminUrl = app === "wordpress"
    ? `${siteUrl}/wp-admin`
    : `${siteUrl}/admin`

  return {
    success: true,
    installId: installId || undefined,
    siteUrl,
    adminUrl,
  }
}

/**
 * Installe WordPress ou PrestaShop via Softaculous en utilisant un token API cPanel directement.
 * Contourne WHM — utile sur o2switch mutualisé où l'API WHM est bloquée depuis les IPs externes.
 */
export async function installAppWithToken(
  host: string,         // hostname du serveur cPanel (ex: "campus01.o2switch.net")
  cpanelUser: string,
  cpanelToken: string,  // token API généré dans cPanel → Security → Manage API Tokens
  app: SoftAppType,
  options: {
    domain: string
    path?: string
    adminUser: string
    adminPass: string
    adminEmail: string
    siteName: string
  },
): Promise<SoftaculousInstallResult> {
  const scriptId = SOFTACULOUS_SCRIPT_IDS[app]

  const params = new URLSearchParams({
    act: "install",
    api: "json",
    softdomain: options.domain,
    softdirectory: options.path ?? "",
    admin_username: options.adminUser,
    admin_pass: options.adminPass,
    admin_email: options.adminEmail,
    site_name: options.siteName,
    overwrite_existing: "0",
  })

  const url = `https://${host}:2083/frontend/jupiter/softaculous/index.live.php?softid=${scriptId}&${params.toString()}`

  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
  let res: Response
  try {
    res = await fetchWithRetry(url, {
      headers: { Authorization: `cpanel ${cpanelUser}:${cpanelToken}` },
    })
  } finally {
    if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev
  }

  const text = await res.text()
  const parsed = parseMaybeJson(text)

  const softError = extractSoftError(parsed)
  if (softError) return { success: false, error: softError }
  if (!res.ok) return { success: false, error: `HTTP ${res.status}` }

  const installId = typeof parsed?.insid === "string"
    ? parsed.insid
    : typeof parsed?.data === "object" && parsed?.data !== null
      ? String((parsed.data as Record<string, unknown>).insid ?? "")
      : ""

  const siteUrl = `https://${options.domain}${options.path ? `/${options.path}` : ""}`
  const adminUrl = app === "wordpress" ? `${siteUrl}/wp-admin` : `${siteUrl}/admin`

  return { success: true, installId: installId || undefined, siteUrl, adminUrl }
}

/**
 * Clone une installation existante vers un nouveau sous-domaine.
 * Utilisé comme fallback quand Softaculous Install direct n'est pas disponible.
 */
export async function cloneApp(
  whmConfig: WhmClientConfig,
  cpanelUser: string,
  sourceInstallId: string,
  targetDomain: string,
  targetPath = "",
): Promise<SoftaculousInstallResult> {
  const { host, cpsess, cookie } = await getCPanelSessionData(whmConfig, cpanelUser)
  const baseUrl = `https://${host}:2083/${cpsess}`

  const params = new URLSearchParams({
    act: "cloneInst",
    api: "json",
    insid: sourceInstallId,
    softdomain: targetDomain,
    softdirectory: targetPath,
  })

  const url = `${baseUrl}/frontend/jupiter/softaculous/index.live.php?${params.toString()}`
  const res = await fetchWithRetry(url, { headers: { Cookie: cookie } })
  const text = await res.text()
  const parsed = parseMaybeJson(text)
  const softError = extractSoftError(parsed)

  if (softError) return { success: false, error: softError }
  if (!res.ok) return { success: false, error: `HTTP ${res.status}` }

  const siteUrl = `https://${targetDomain}${targetPath ? `/${targetPath}` : ""}`
  return { success: true, siteUrl, adminUrl: `${siteUrl}/wp-admin` }
}
