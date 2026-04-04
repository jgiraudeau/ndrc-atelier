/**
 * POST /api/provisioning/jobs/[jobId]/run
 * Lance l'exécution d'un job de provisioning.
 * Réservé aux formateurs (TEACHER) et admins (ADMIN).
 *
 * Utilise waitUntil() pour garder la fonction Vercel vivante
 * pendant toute la durée du provisioning (installations WP/PS longues).
 */
import { NextRequest, NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"
import { requireAuth } from "@/src/lib/api-helpers"
import { runProvisioningJob } from "@/src/lib/provisioning-service"

export const maxDuration = 300 // 5 minutes max (plan Pro Vercel)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const { jobId } = await params

  // waitUntil() maintient la fonction vivante après l'envoi de la réponse
  waitUntil(
    runProvisioningJob(jobId).catch((err: unknown) => {
      console.error(`[provisioning] Job ${jobId} failed:`, err)
    })
  )

  return NextResponse.json({ message: "Job démarré", jobId }, { status: 202 })
}
