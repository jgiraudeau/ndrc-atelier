/**
 * Provisioning Service — ndrc-atelier
 * Orchestre la création automatique de sites WP / PrestaShop pour une classe entière.
 *
 * Architecture Vercel Hobby (60s limit) :
 * - initProvisioningJob() : PENDING → RUNNING, crée les Sites
 * - runProvisioningStep() : traite UN seul élève, appelé en boucle par le client
 */

import { prisma } from "@/src/lib/prisma"
import { installApp, installAppWithToken, createSubdomainWithToken, type SoftAppType } from "@/src/lib/softaculous-service"
import { generatePassword, type WhmClientConfig } from "@/src/lib/whm-service"
import { SiteStatus } from "@prisma/client"

function generateSubdomain(index: number, app: SoftAppType): string {
  return `${app === "wordpress" ? "wp" : "ps"}${index + 1}`
}

/** Sanitize un nom en identifiant valide (alphanum minuscule, max 8 car) */
function sanitizeUsername(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8) || "user"
}

/**
 * Initialise le job (PENDING → RUNNING) et crée les entrées Site en attente.
 * Appelé une fois avant la boucle de steps.
 */
export async function initProvisioningJob(jobId: string): Promise<{ error?: string }> {
  const job = await prisma.provisioningJob.findUnique({
    where: { id: jobId },
    include: { class: { include: { students: true } }, whmConfig: true },
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

  // Récupérer le VRAI domaine du compte cPanel (pas le host WHM)
  const cpanelAccount = await prisma.cpanelAccount.findFirst({
    where: { username: job.class.cpanelUser, whmConfigId: job.whmConfig.id },
    select: { domain: true, cpanelToken: true },
  })

  // Le domaine des sous-domaines = domaine du compte cPanel
  const domain = cpanelAccount?.domain ?? job.whmConfig.host

  const app: SoftAppType = job.siteType === "WORDPRESS" ? "wordpress" : "prestashop"
  const students = job.class.students

  // Créer toutes les entrées Site en PENDING (une par élève)
  for (let i = 0; i < students.length; i++) {
    const student = students[i]
    const subdomain = generateSubdomain(i, app)
    const adminUser = sanitizeUsername(`${student.firstName}${student.lastName}`)
    const adminPass = generatePassword(12)

    await prisma.site.upsert({
      where: { subdomain_domain: { subdomain, domain } },
      create: {
        type: job.siteType,
        subdomain,
        domain,
        url: `https://${subdomain}.${domain}`,
        cpanelUser: job.class.cpanelUser!,
        adminUser,
        adminPass,
        status: SiteStatus.PENDING,
        studentId: student.id,
        provisioningJobId: jobId,
      },
      update: { provisioningJobId: jobId },
    })
  }

  const initLog = [`[${new Date().toISOString()}] Démarrage provisioning ${app.toUpperCase()} pour ${students.length} élèves de la classe ${job.class.name} (domaine: ${domain})`]
  await prisma.provisioningJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", log: initLog },
  })

  return {}
}

/**
 * Traite UN seul élève (le prochain site PENDING du job).
 * Retourne { done: true } quand tous les élèves sont traités.
 */
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

  // Trouver le prochain site PENDING
  const site = await prisma.site.findFirst({
    where: { provisioningJobId: jobId, status: SiteStatus.PENDING },
    include: { student: true },
    orderBy: { createdAt: "asc" },
  })

  if (!site) {
    // Plus rien à traiter — statut final
    const allSites = await prisma.site.findMany({ where: { provisioningJobId: jobId } })
    const successCount = allSites.filter(s => s.status === SiteStatus.ACTIVE).length
    const errorCount = allSites.filter(s => s.status === SiteStatus.ERROR).length
    const finalStatus = errorCount === 0 ? "COMPLETED" : successCount === 0 ? "FAILED" : "PARTIAL"
    await prisma.provisioningJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        log: { push: `[${new Date().toISOString()}] Terminé. ${successCount} succès, ${errorCount} erreurs. Statut : ${finalStatus}` },
        updatedAt: new Date(),
      },
    })
    return { done: true }
  }

  // Token et config cPanel
  const cpanelAccount = await prisma.cpanelAccount.findFirst({
    where: { username: job.class.cpanelUser!, whmConfigId: job.whmConfig.id },
    select: { cpanelToken: true, domain: true },
  })

  const whmConfig: WhmClientConfig = {
    host: `https://${job.whmConfig.host}:${job.whmConfig.port}`,
    user: job.whmConfig.whmUser,
    token: job.whmConfig.whmToken,
  }

  const app: SoftAppType = job.siteType === "WORDPRESS" ? "wordpress" : "prestashop"
  const { subdomain, domain, cpanelUser, adminUser, adminPass } = site

  // Marquer CREATING
  await prisma.site.update({ where: { id: site.id }, data: { status: SiteStatus.CREATING } })
  await prisma.provisioningJob.update({
    where: { id: jobId },
    data: {
      log: { push: `[${new Date().toISOString()}] → ${site.student.firstName} ${site.student.lastName} : création ${subdomain}.${domain}...` },
      updatedAt: new Date(),
    },
  })

  try {
    // 1. Créer le sous-domaine via token cPanel
    if (cpanelAccount?.cpanelToken) {
      const subResult = await createSubdomainWithToken(
        job.whmConfig.host, cpanelUser, cpanelAccount.cpanelToken, subdomain, domain
      )
      if (!subResult.success) {
        await prisma.provisioningJob.update({
          where: { id: jobId },
          data: { log: { push: `[${new Date().toISOString()}]   ⚠ Sous-domaine : ${subResult.error}` } },
        })
      }
    }

    // 2. Installer l'application
    const installOptions = {
      domain: `${subdomain}.${domain}`,
      adminUser: adminUser!,
      adminPass: adminPass!,
      adminEmail: `${adminUser}@${domain}`,
      siteName: `${site.student.firstName} ${site.student.lastName} — ${app === "wordpress" ? "WordPress" : "PrestaShop"}`,
    }

    const result = cpanelAccount?.cpanelToken
      ? await installAppWithToken(job.whmConfig.host, cpanelUser, cpanelAccount.cpanelToken, app, installOptions)
      : await installApp(whmConfig, cpanelUser, app, installOptions)

    if (result.success) {
      await prisma.site.update({
        where: { id: site.id },
        data: { status: SiteStatus.ACTIVE, url: result.siteUrl ?? site.url, adminUrl: result.adminUrl, softaculousInstallId: result.installId },
      })
      await prisma.provisioningJob.update({
        where: { id: jobId },
        data: { log: { push: `[${new Date().toISOString()}]   ✓ ${subdomain} créé — ${result.siteUrl}` }, updatedAt: new Date() },
      })
    } else {
      await prisma.site.update({ where: { id: site.id }, data: { status: SiteStatus.ERROR } })
      await prisma.provisioningJob.update({
        where: { id: jobId },
        data: { log: { push: `[${new Date().toISOString()}]   ✗ ${subdomain} ERREUR : ${result.error}` }, updatedAt: new Date() },
      })
    }
  } catch (err: unknown) {
    await prisma.site.update({ where: { id: site.id }, data: { status: SiteStatus.ERROR } })
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.provisioningJob.update({
      where: { id: jobId },
      data: { log: { push: `[${new Date().toISOString()}]   ✗ ${subdomain} EXCEPTION : ${msg}` }, updatedAt: new Date() },
    })
  }

  const remaining = await prisma.site.count({ where: { provisioningJobId: jobId, status: SiteStatus.PENDING } })
  return { done: remaining === 0 }
}
