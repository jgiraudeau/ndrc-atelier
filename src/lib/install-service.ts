/**
 * Install Service — ndrc-atelier
 * Installe WP ou PS sur une liste de sous-domaines cibles via Softaculous.
 */

import { prisma } from "@/src/lib/prisma"
import { type WhmClientConfig } from "@/src/lib/whm-service"
import { installApp, type SoftAppType } from "@/src/lib/softaculous-service"
import { SiteStatus } from "@prisma/client"

function randomPass(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#"
  return Array.from(crypto.getRandomValues(new Uint8Array(14)))
    .map(b => chars[b % chars.length])
    .join("")
}

async function getWhmConfig(): Promise<WhmClientConfig & { host: string }> {
  const config = await prisma.whmConfig.findFirst({ where: { isActive: true } })
  if (!config) throw new Error("Aucune config WHM active")
  return { host: `https://${config.host}:${config.port}`, user: config.whmUser, token: config.whmToken }
}

export async function runInstallJob(params: {
  subdomains: string[]
  cpanelUser: string
  siteType: "WORDPRESS" | "PRESTASHOP"
}): Promise<void> {
  const { subdomains, cpanelUser, siteType } = params
  console.log(`[install] ${siteType} → ${subdomains.length} cibles`)

  const whmConfig = await getWhmConfig()
  const app: SoftAppType = siteType === "WORDPRESS" ? "wordpress" : "prestashop"

  const cpanelAccount = await prisma.cpanelAccount.findFirst({
    where: { username: cpanelUser },
    select: { domain: true },
  })
  let domain = cpanelAccount?.domain ?? ""
  if (!domain) {
    const sampleSite = await prisma.site.findFirst({ where: { cpanelUser }, select: { domain: true } })
    domain = sampleSite?.domain ?? ""
    if (domain) console.log(`[install] domaine déduit depuis les sites: ${domain}`)
  }

  for (const subdomain of subdomains) {
    const targetDomain = `${subdomain}.${domain}`
    console.log(`[install] → ${targetDomain}...`)

    await prisma.site.updateMany({
      where: { subdomain, cpanelUser },
      data: { status: SiteStatus.CREATING },
    })

    const adminUser = "admin"
    const adminPass = randomPass()
    const siteName = siteType === "WORDPRESS" ? "Mon Site WordPress" : "Ma Boutique PrestaShop"

    try {
      const result = await installApp(whmConfig, cpanelUser, app, {
        targetDomain,
        adminEmail: "admin@example.com",
        siteName,
        adminUser,
        adminPass,
      })

      if (result.success) {
        await prisma.site.updateMany({
          where: { subdomain, cpanelUser },
          data: {
            status: SiteStatus.ACTIVE,
            url: result.siteUrl,
            adminUrl: result.adminUrl,
            adminUser: result.adminUser ?? adminUser,
            adminPass: result.adminPass ?? adminPass,
          },
        })
        console.log(`[install]   ✓ ${targetDomain}`)
      } else {
        throw new Error(result.error ?? "Erreur inconnue")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[install]   ✗ ${targetDomain}:`, msg)
      await prisma.site.updateMany({
        where: { subdomain, cpanelUser },
        data: { status: SiteStatus.ERROR },
      })
    }
  }

  console.log(`[install] Terminé`)
}
