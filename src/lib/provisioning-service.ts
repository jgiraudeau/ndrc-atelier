/**
 * Provisioning Service — ndrc-atelier
 * Orchestre la création automatique de sites WP / PrestaShop pour une classe entière.
 * 1 job = 1 type de site (WORDPRESS ou PRESTASHOP) pour tous les élèves d'une classe.
 *
 * Architecture Vercel Hobby (60s limit) :
 * - runProvisioningStep() traite UN seul élève et retourne
 * - Le client appelle /step en boucle jusqu'à { done: true }
 */

import { prisma } from "@/src/lib/prisma"
import { installApp, installAppWithToken, createSubdomainWithToken, type SoftAppType } from "@/src/lib/softaculous-service"
import { generatePassword, type WhmClientConfig } from "@/src/lib/whm-service"
import { SiteStatus } from "@prisma/client"

function generateSubdomain(index: number, app: SoftAppType): string {
  return `${app === "wordpress" ? "wp" : "ps"}${index + 1}`
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

  const app: SoftAppType = job.siteType === "WORDPRESS" ? "wordpress" : "prestashop"
  const domain = job.whmConfig.host
  const students = job.class.students

  // Créer toutes les entrées Site en PENDING (une par élève)
  for (let i = 0; i < students.length; i++) {
    const student = students[i]
    const subdomain = generateSubdomain(i, app)
    const adminUser = `${student.firstName.slice(0, 4).toLowerCase()}${student.lastName.slice(0, 4).toLowerCase()}`
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

  const initLog = [`[${new Date().toISOString()}] Démarrage provisioning ${app.toUpperCase()} pour ${students.length} élèves de la classe ${job.class.name}`]
  await prisma.provisioningJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", log: initLog },
  })

  return {}
}

/**
 * Traite UN seul élève (le prochain site PENDING du job).
 * Retourne { done: true } quand tous les élèves sont traités.
 * Conçu pour être appelé en boucle depuis le client (Vercel Hobby 60s).
 */
export async function runProvisioningStep(jobId: string): Promise<{ done: boolean; error?: string }> {
  const job = await prisma.provisioningJob.findUnique({
    where: { id: jobId },
    include: { class: true, whmConfig: true },
  })

  if (!job) return { done: true, error: `Job ${jobId} introuvable` }
  if (job.status === "COMPLETED" || job.status === "FAILED") return { done: true }

  // Initialiser si nécessaire
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
    // Plus rien à traiter — calculer le statut final
    const allSites = await prisma.site.findMany({ where: { provisioningJobId: jobId } })
    const successCount = allSites.filter(s => s.status === SiteStatus.ACTIVE).length
    const errorCount = allSites.filter(s => s.status === SiteStatus.ERROR).length
    const finalStatus = errorCount === 0 ? "COMPLETED" : successCount === 0 ? "FAILED" : "PARTIAL"

    const finalLog = `[${new Date().toISOString()}] Terminé. ${successCount} succès, ${errorCount} erreurs. Statut : ${finalStatus}`
    await prisma.provisioningJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        log: { push: finalLog },
        updatedAt: new Date(),
      },
    })
    return { done: true }
  }

  // Récupérer le token cPanel
  const cpanelAccount = await prisma.cpanelAccount.findFirst({
    where: { username: job.class.cpanelUser!, whmConfigId: job.whmConfig.id },
    select: { cpanelToken: true },
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
      log: { push: `[${new Date().toISOString()}] → ${site.student.firstName} ${site.student.lastName} : création ${subdomain}...` },
      updatedAt: new Date(),
    },
  })

  try {
    // 1. Créer le sous-domaine
    if (cpanelAccount?.cpanelToken) {
      const subResult = await createSubdomainWithToken(job.whmConfig.host, cpanelUser, cpanelAccount.cpanelToken, subdomain, domain)
      if (!subResult.success) {
        await prisma.provisioningJob.update({
          where: { id: jobId },
          data: { log: { push: `[${new Date().toISOString()}]   ⚠ Sous-domaine ${subdomain} : ${subResult.error}` } },
        })
      }
    }

    // 2. Installer l'application
    const installOptions = {
      domain: `${subdomain}.${domain}`,
      adminUser: adminUser!,
      adminPass: adminPass!,
      adminEmail: `${adminUser}@ndrc-atelier.local`,
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

  // Vérifier s'il reste des sites PENDING
  const remaining = await prisma.site.count({ where: { provisioningJobId: jobId, status: SiteStatus.PENDING } })
  return { done: remaining === 0 }
}
