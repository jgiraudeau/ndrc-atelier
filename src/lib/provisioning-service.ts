/**
 * Provisioning Service — ndrc-atelier
 * Crée 30 sous-domaines WP ou PS sur un compte cPanel.
 * Pas de lien élève à ce stade — affectation manuelle après.
 *
 * Architecture step-by-step (limite 60s Vercel, Railway sans limite).
 */

import { prisma } from "@/src/lib/prisma"
import { type WhmClientConfig } from "@/src/lib/whm-service"
import { createSubdomain, type SoftAppType } from "@/src/lib/softaculous-service"
import { SiteStatus } from "@prisma/client"

const SLOTS = 30       // sous-domaines élèves
const MODEL_SLOTS = 3  // sous-domaines modèles

function generateSubdomains(app: SoftAppType): string[] {
  const prefix = app === "wordpress" ? "wp" : "ps"
  const modelPrefix = app === "wordpress" ? "modelewp" : "modeleps"
  const models = Array.from({ length: MODEL_SLOTS }, (_, i) => `${modelPrefix}${i + 1}`)
  const slots = Array.from({ length: SLOTS }, (_, i) => `${prefix}${i + 1}`)
  return [...models, ...slots]
}

export async function initProvisioningJob(jobId: string): Promise<{ error?: string }> {
  const job = await prisma.provisioningJob.findUnique({
    where: { id: jobId },
    include: { class: true, whmConfig: true },
  })

  if (!job) return { error: `Job ${jobId} introuvable` }
  if (job.status === "RUNNING" || job.status === "COMPLETED") return {}

  if (!job.class.cpanelUser) {
    await prisma.provisioningJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: "Aucun compte cPanel assigné à cette classe." },
    })
    return { error: "Aucun compte cPanel assigné à cette classe." }
  }

  const cpanelAccount = await prisma.cpanelAccount.findFirst({
    where: { username: job.class.cpanelUser },
    select: { domain: true },
  })

  let domain = cpanelAccount?.domain
  if (!domain) {
    const sampleSite = await prisma.site.findFirst({ where: { cpanelUser: job.class.cpanelUser }, select: { domain: true } })
    domain = sampleSite?.domain ?? job.whmConfig.host
    if (sampleSite?.domain) console.log(`[provisioning] domaine déduit depuis les sites: ${domain}`)
  }
  const app: SoftAppType = job.siteType === "WORDPRESS" ? "wordpress" : "prestashop"
  const subdomains = generateSubdomains(app)

  // Créer 33 entrées Site PENDING (3 modèles + 30 élèves)
  const modelPrefix = app === "wordpress" ? "modelewp" : "modeleps"
  for (const subdomain of subdomains) {
    const isModel = subdomain.startsWith(modelPrefix)
    await prisma.site.upsert({
      where: { subdomain_domain: { subdomain, domain } },
      create: {
        type: job.siteType,
        subdomain,
        domain,
        url: `https://${subdomain}.${domain}`,
        cpanelUser: job.class.cpanelUser!,
        isModel,
        status: SiteStatus.PENDING,
        provisioningJobId: jobId,
      },
      update: { provisioningJobId: jobId, status: SiteStatus.PENDING },
    })
  }

  await prisma.provisioningJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      log: [`[${new Date().toISOString()}] Démarrage création ${subdomains.length} sous-domaines ${app.toUpperCase()} sur ${domain} (${MODEL_SLOTS} modèles + ${SLOTS} élèves)`],
    },
  })

  return {}
}

export async function runProvisioningStep(jobId: string): Promise<{ done: boolean; error?: string }> {
  const job = await prisma.provisioningJob.findUnique({
    where: { id: jobId },
    include: { class: true, whmConfig: true },
  })

  if (!job) return { done: true, error: `Job ${jobId} introuvable` }
  if (job.status === "COMPLETED" || job.status === "FAILED") return { done: true }

  if (job.status === "PENDING") {
    const initResult = await initProvisioningJob(jobId)
    if (initResult.error) return { done: true, error: initResult.error }
  }

  const site = await prisma.site.findFirst({
    where: { provisioningJobId: jobId, status: SiteStatus.PENDING },
    orderBy: { createdAt: "asc" },
  })

  if (!site) {
    const allSites = await prisma.site.findMany({ where: { provisioningJobId: jobId } })
    const successCount = allSites.filter(s => s.status === SiteStatus.ACTIVE).length
    const errorCount = allSites.filter(s => s.status === SiteStatus.ERROR).length
    const finalStatus = errorCount === 0 ? "COMPLETED" : successCount === 0 ? "FAILED" : "PARTIAL"
    await prisma.provisioningJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        log: { push: `[${new Date().toISOString()}] Terminé. ${successCount} succès, ${errorCount} erreurs.` },
        updatedAt: new Date(),
      },
    })
    return { done: true }
  }

  const whmConfig: WhmClientConfig = {
    host: `https://${job.whmConfig.host}:${job.whmConfig.port}`,
    user: job.whmConfig.whmUser,
    token: job.whmConfig.whmToken,
  }

  const app: SoftAppType = job.siteType === "WORDPRESS" ? "wordpress" : "prestashop"
  const { subdomain, domain, cpanelUser } = site

  await prisma.site.update({ where: { id: site.id }, data: { status: SiteStatus.CREATING } })
  await prisma.provisioningJob.update({
    where: { id: jobId },
    data: { log: { push: `[${new Date().toISOString()}] → Création sous-domaine ${subdomain}.${domain}...` }, updatedAt: new Date() },
  })

  try {
    const subResult = await createSubdomain(whmConfig, cpanelUser, subdomain, domain)

    if (subResult.success) {
      await prisma.site.update({ where: { id: site.id }, data: { status: SiteStatus.ACTIVE } })
      await prisma.provisioningJob.update({
        where: { id: jobId },
        data: { log: { push: `[${new Date().toISOString()}]   ✓ ${subdomain}.${domain} créé` }, updatedAt: new Date() },
      })
    } else {
      await prisma.site.update({ where: { id: site.id }, data: { status: SiteStatus.ERROR } })
      await prisma.provisioningJob.update({
        where: { id: jobId },
        data: { log: { push: `[${new Date().toISOString()}]   ✗ ${subdomain} ERREUR : ${subResult.error}` }, updatedAt: new Date() },
      })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.site.update({ where: { id: site.id }, data: { status: SiteStatus.ERROR } })
    await prisma.provisioningJob.update({
      where: { id: jobId },
      data: { log: { push: `[${new Date().toISOString()}]   ✗ ${subdomain} EXCEPTION : ${msg}` }, updatedAt: new Date() },
    })
  }

  const remaining = await prisma.site.count({
    where: { provisioningJobId: jobId, status: { in: [SiteStatus.PENDING, SiteStatus.CREATING] } }
  })
  return { done: remaining === 0 }
}
