/**
 * POST /api/provisioning/jobs/[jobId]/run
 * Lance l'exécution d'un job de provisioning.
 * Réservé aux formateurs (TEACHER) et admins (ADMIN).
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { runProvisioningJob } from "@/src/lib/provisioning-service"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const { jobId } = await params

  // Lancer le job en tâche de fond (sans await) pour retour immédiat
  // Le statut peut être consulté via GET /api/provisioning/jobs
  runProvisioningJob(jobId).catch((err: unknown) => {
    console.error(`[provisioning] Job ${jobId} failed:`, err)
  })

  return NextResponse.json({ message: "Job démarré", jobId }, { status: 202 })
}
