/**
 * Clone Service — ndrc-atelier
 * Clone un site modèle (WP ou PS) vers plusieurs sous-domaines cibles.
 * Même approche que whm-manager/clone : session WHM → formulaire sclone → POST.
 */

import { prisma } from "@/src/lib/prisma"
import { getCPanelSessionData, type WhmClientConfig } from "@/src/lib/whm-service"
import { SiteStatus } from "@prisma/client"

function parseMaybeJson(input: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(input) as unknown
    if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>
  } catch { /* ignore */ }
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
      // grouped format
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

function secureDbSuffix(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")
}

function extractInputValue(html: string, fieldName: string): string | null {
  const escapedName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = html.match(new RegExp(`<input\\b[^>]*\\bname=["']${escapedName}["'][^>]*>`, "i"))
  if (!match) return null
  const valueMatch = match[0].match(/\bvalue=["']([^"']*)["']/i)
  return valueMatch ? valueMatch[1] : null
}

function extractSelectOptions(html: string, selectName: string): { value: string; selected: boolean; label: string }[] {
  const escapedName = selectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const selectMatch = html.match(new RegExp(`<select\\b[^>]*\\bname=["']${escapedName}["'][^>]*>([\\s\\S]*?)<\\/select>`, "i"))
  if (!selectMatch) return []
  const options: { value: string; selected: boolean; label: string }[] = []
  const optionRegex = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi
  let match: RegExpExecArray | null
  while ((match = optionRegex.exec(selectMatch[1])) !== null) {
    const attrs = match[1] ?? ""
    const valueMatch = attrs.match(/\bvalue=["']([^"']*)["']/i)
    options.push({
      value: valueMatch?.[1]?.trim() ?? "",
      label: match[2].replace(/<[^>]+>/g, "").trim(),
      selected: /\bselected\b/i.test(attrs),
    })
  }
  return options
}

async function getWhmConfig(): Promise<WhmClientConfig & { host: string }> {
  const config = await prisma.whmConfig.findFirst({ where: { isActive: true } })
  if (!config) throw new Error("Aucune config WHM active")
  return { host: `https://${config.host}:${config.port}`, user: config.whmUser, token: config.whmToken }
}

/**
 * Clone sourceSubdomain vers chaque targetSubdomain.
 * Met à jour les Sites en base au fur et à mesure.
 */
export async function runCloneJob(params: {
  sourceSubdomain: string
  targetSubdomains: string[]
  cpanelUser: string
}): Promise<void> {
  const { sourceSubdomain, targetSubdomains, cpanelUser } = params
  console.log(`[clone] Source: ${sourceSubdomain} → ${targetSubdomains.length} cibles`)

  const whmConfig = await getWhmConfig()
  const session = await getCPanelSessionData(whmConfig, cpanelUser)
  const baseUrl = `https://${session.host}:2083/${session.cpsess}`
  const cookie = session.cookie

  // Récupérer le domaine du compte
  const cpanelAccount = await prisma.cpanelAccount.findFirst({ where: { username: cpanelUser }, select: { domain: true } })
  const domain = cpanelAccount?.domain ?? whmConfig.host

  // Trouver l'installId du site source dans Softaculous
  const listRes = await fetch(`${baseUrl}/frontend/jupiter/softaculous/index.live.php?act=installations&api=json`, {
    headers: { Cookie: cookie },
  })
  const listText = await listRes.text()
  const listData = parseMaybeJson(listText)
  const installations = extractInstallations(listData)

  // Chercher le source par subdomain
  const sourceUrl = `${sourceSubdomain}.${domain}`.toLowerCase()
  let installId: string | null = null
  console.log(`[clone] Recherche installId pour: ${sourceUrl}`)
  console.log(`[clone] Installations disponibles:`, JSON.stringify(Object.entries(installations).map(([id, i]) => ({ id, url: i.softurl, domain: i.domain }))))
  for (const [id, install] of Object.entries(installations)) {
    const raw = (install.softurl ?? install.domain ?? "").toLowerCase()
    const installHost = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "")
    const sourceClean = sourceUrl.replace(/^www\./, "")
    if (
      installHost === sourceClean ||
      installHost === sourceSubdomain.toLowerCase() ||
      installHost.startsWith(sourceSubdomain.toLowerCase() + ".")
    ) {
      installId = id
      break
    }
  }

  if (!installId) {
    console.error(`[clone] Installation source ${sourceUrl} introuvable dans Softaculous`)
    // Mettre les sites en ERROR
    await prisma.site.updateMany({
      where: { subdomain: { in: targetSubdomains }, domain },
      data: { status: SiteStatus.ERROR },
    })
    return
  }

  console.log(`[clone] installId source: ${installId}`)

  // Charger le formulaire de clonage pour récupérer soft_status_key et softproto
  const formRes = await fetch(`${baseUrl}/frontend/jupiter/softaculous/index.live.php?act=sclone&insid=${encodeURIComponent(installId)}`, {
    headers: { Cookie: cookie },
  })
  const formHtml = await formRes.text()
  const softStatusKey = extractInputValue(formHtml, "soft_status_key")
  if (!softStatusKey) {
    console.error(`[clone] soft_status_key introuvable`)
    return
  }

  const softprotoOptions = extractSelectOptions(formHtml, "softproto")
  const softproto = softprotoOptions.find(o => o.selected && o.value) ?? softprotoOptions.find(o => o.value)
  if (!softproto?.value) {
    console.error(`[clone] softproto introuvable`)
    return
  }

  // Cloner vers chaque cible
  for (const targetSubdomain of targetSubdomains) {
    const targetUrl = `${targetSubdomain}.${domain}`
    console.log(`[clone] → Clonage vers ${targetUrl}...`)

    // Marquer CREATING
    await prisma.site.updateMany({
      where: { subdomain: targetSubdomain, domain },
      data: { status: SiteStatus.CREATING },
    })

    try {
      const cloneParams = new URLSearchParams({
        softsubmit: "Cloner",
        softproto: softproto.value,
        softdomain: targetUrl,
        softdirectory: "",
        softdb: `cln${secureDbSuffix()}`,
        soft_status_key: softStatusKey,
      })

      const cloneRes = await fetch(
        `${baseUrl}/frontend/jupiter/softaculous/index.live.php?act=sclone&insid=${encodeURIComponent(installId)}&api=json`,
        {
          method: "POST",
          headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
          body: cloneParams.toString(),
        }
      )

      const cloneText = await cloneRes.text()
      const cloneData = parseMaybeJson(cloneText)

      // Détecter les erreurs : JSON mal formé OU erreur Softaculous OU HTTP non-OK
      if (!cloneRes.ok) {
        throw new Error(`HTTP ${cloneRes.status}`)
      }
      if (!cloneData) {
        throw new Error(`Réponse Softaculous non-JSON : ${cloneText.slice(0, 200)}`)
      }
      const softError = extractSoftError(cloneData)
      if (softError) {
        throw new Error(softError)
      }

      const siteUrl = `https://${targetUrl}`

      // Attendre que Softaculous enregistre le clone (traitement asynchrone côté serveur)
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Récupérer l'adminUrl réelle depuis Softaculous (ex: /adminXXXXXX pour PS, /wp-admin pour WP)
      let adminUrl: string | null = null
      try {
        const refreshRes = await fetch(`${baseUrl}/frontend/jupiter/softaculous/index.live.php?act=installations&api=json`, {
          headers: { Cookie: cookie },
        })
        const refreshData = parseMaybeJson(await refreshRes.text())
        const refreshedInstalls = extractInstallations(refreshData)
        const targetClean = targetUrl.toLowerCase()
        for (const install of Object.values(refreshedInstalls)) {
          const installHost = (install.softurl ?? install.domain ?? "").toLowerCase()
            .replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "")
          if (installHost === targetClean || installHost === `${targetSubdomain}.${domain}`.toLowerCase()) {
            if (install.adminurl) {
              adminUrl = install.adminurl.startsWith("http") ? install.adminurl : `${siteUrl}/${install.adminurl.replace(/^\//, "")}`
            }
            break
          }
        }
      } catch (e) {
        console.warn(`[clone] Impossible de récupérer adminUrl pour ${targetUrl}:`, e)
      }

      // Utiliser uniquement subdomain+domain (clé unique) pour éviter les faux zéros sur cpanelUser
      await prisma.site.updateMany({
        where: { subdomain: targetSubdomain, domain },
        data: { status: SiteStatus.ACTIVE, url: siteUrl, adminUrl },
      })
      console.log(`[clone]   ✓ ${targetUrl} cloné`)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[clone]   ✗ ${targetUrl} ERREUR:`, msg)
      await prisma.site.updateMany({
        where: { subdomain: targetSubdomain, domain },
        data: { status: SiteStatus.ERROR },
      })
    }
  }

  console.log(`[clone] Terminé`)
}
