/**
 * POST /api/provisioning/jobs/[jobId]/run
 * Lance l'exécution d'un job de provisioning.
 * Réservé aux formateurs (TEACHER) et admins (ADMIN).
 *
 * Utilise waitUntil() pour garder la fonction Vercel vivante
 * pendant toute la durée du provisioning (installations WP/PS longues).
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/src/lib/api-helpers"
import { initProvisioningJob } from "@/src/lib/provisioning-service"

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const { jobId } = await params

  // Initialise le job (PENDING → RUNNING) et crée les entrées Site
  // Le client appellera ensuite /step en boucle pour traiter élève par élève
  const result = await initProvisioningJob(jobId)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ message: "Job initialisé", jobId }, { status: 202 })
}
