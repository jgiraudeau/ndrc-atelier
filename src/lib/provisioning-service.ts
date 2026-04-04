/**
 * Provisioning Service — ndrc-atelier
 * Orchestre la création automatique de sites WP / PrestaShop pour une classe entière.
 * 1 job = 1 type de site (WORDPRESS ou PRESTASHOP) pour tous les élèves d'une classe.
 */

import { prisma } from "@/src/lib/prisma"
import { installApp, installAppWithToken, createSubdomainWithToken, type SoftAppType } from "@/src/lib/softaculous-service"
import { generatePassword, type WhmClientConfig } from "@/src/lib/whm-service"
import { SiteStatus } from "@prisma/client"

/**
 * Génère un sous-domaine numéroté pour un élève.
 * ex: wp1, wp2, ps1, ps2...
 * Le sous-domaine est relatif au compte cPanel de la classe.
 */
function generateSubdomain(index: number, app: SoftAppType): string {
  return `${app === "wordpress" ? "wp" : "ps"}${index + 1}`
}

/**
 * Lance un job de provisioning pour une classe.
 * Crée les sites un par un et met à jour le job en temps réel.
 */
export async function runProvisioningJob(jobId: string): Promise<void> {
  const job = await prisma.provisioningJob.findUnique({
    where: { id: jobId },
    include: {
      class: { include: { students: true } },
      whmConfig: true,
    },
  })


  if (!job) throw new Error(`Job ${jobId} introuvable`)
  if (job.status === "RUNNING") throw new Error(`Job ${jobId} déjà en cours`)

  // Vérifier qu'un compte cPanel est assigné à la classe
  if (!job.class.cpanelUser) {
    await prisma.provisioningJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: "Aucun compte cPanel assigné à cette classe. Configurez-le dans /admin/cpanel-accounts." },
    })
    return
  }

  const log: string[] = []
  const addLog = async (msg: string) => {
    log.push(`[${new Date().toISOString()}] ${msg}`)
    await prisma.provisioningJob.update({
      where: { id: jobId },
      data: { log, updatedAt: new Date() },
    })
  }

  await prisma.provisioningJob.update({
    where: { id: jobId },
    data: { status: "RUNNING" },
  })

  const whmConfig: WhmClientConfig = {
    host: `https://${job.whmConfig.host}:${job.whmConfig.port}`,
    user: job.whmConfig.whmUser,
    token: job.whmConfig.whmToken,
  }

  // Récupérer le token cPanel du compte assigné à la classe (pour bypass WHM API)
  const cpanelAccount = job.class.cpanelUser
    ? await prisma.cpanelAccount.findFirst({
        where: { username: job.class.cpanelUser, whmConfigId: job.whmConfig.id },
        select: { cpanelToken: true },
      })
    : null

  const app: SoftAppType = job.siteType === "WORDPRESS" ? "wordpress" : "prestashop"
  const students = job.class.students
  const domain = job.whmConfig.host

  await addLog(`Démarrage provisioning ${app.toUpperCase()} pour ${students.length} élèves de la classe ${job.class.name}`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < students.length; i++) {
    const student = students[i]
    const subdomain = generateSubdomain(i, app)
    const adminUser = `${student.firstName.slice(0, 4).toLowerCase()}${student.lastName.slice(0, 4).toLowerCase()}`
    const adminPass = generatePassword(12)

    await addLog(`→ ${student.firstName} ${student.lastName} : création ${subdomain}...`)

    // Marquer le site comme CREATING
    const site = await prisma.site.upsert({
      where: { subdomain_domain: { subdomain, domain } },
      create: {
        type: job.siteType,
        subdomain,
        domain,
        url: `https://${subdomain}.${domain}`,
        cpanelUser: job.class.cpanelUser!,
        adminUser,
        adminPass,
        status: SiteStatus.CREATING,
        studentId: student.id,
        provisioningJobId: jobId,
      },
      update: {
        status: SiteStatus.CREATING,
        provisioningJobId: jobId,
      },
    })

    try {
      // Créer le sous-domaine dans cPanel si token disponible
      if (cpanelAccount?.cpanelToken) {
        const subResult = await createSubdomainWithToken(
          job.whmConfig.host,
          site.cpanelUser,
          cpanelAccount.cpanelToken,
          subdomain,
          domain,
        )
        if (!subResult.success) {
          await addLog(`  ⚠ Sous-domaine ${subdomain} : ${subResult.error}`)
          // On continue quand même — le sous-domaine existe peut-être déjà
        } else {
          await addLog(`  → Sous-domaine ${subdomain}.${domain} créé`)
        }
      }

      // Utilise le token cPanel direct si disponible (bypass WHM — o2switch mutualisé)
      const installOptions = {
        domain: `${subdomain}.${domain}`,
        adminUser,
        adminPass,
        adminEmail: `${adminUser}@ndrc-atelier.local`,
        siteName: `${student.firstName} ${student.lastName} — ${app === "wordpress" ? "WordPress" : "PrestaShop"}`,
      }
      const result = cpanelAccount?.cpanelToken
        ? await installAppWithToken(job.whmConfig.host, site.cpanelUser, cpanelAccount.cpanelToken, app, installOptions)
        : await installApp(whmConfig, site.cpanelUser, app, installOptions)

      if (result.success) {
        await prisma.site.update({
          where: { id: site.id },
          data: {
            status: SiteStatus.ACTIVE,
            url: result.siteUrl ?? site.url,
            adminUrl: result.adminUrl,
            softaculousInstallId: result.installId,
          },
        })
        await addLog(`  ✓ ${subdomain} créé — ${result.siteUrl}`)
        successCount++
      } else {
        await prisma.site.update({
          where: { id: site.id },
          data: { status: SiteStatus.ERROR },
        })
        await addLog(`  ✗ ${subdomain} ERREUR : ${result.error}`)
        errorCount++
      }
    } catch (err: unknown) {
      await prisma.site.update({
        where: { id: site.id },
        data: { status: SiteStatus.ERROR },
      })
      const msg = err instanceof Error ? err.message : String(err)
      await addLog(`  ✗ ${subdomain} EXCEPTION : ${msg}`)
      errorCount++
    }
  }

  const finalStatus =
    errorCount === 0 ? "COMPLETED" :
    successCount === 0 ? "FAILED" :
    "PARTIAL"

  await prisma.provisioningJob.update({
    where: { id: jobId },
    data: { status: finalStatus, updatedAt: new Date() },
  })

  await addLog(`Terminé. ${successCount} succès, ${errorCount} erreurs. Statut : ${finalStatus}`)
}
