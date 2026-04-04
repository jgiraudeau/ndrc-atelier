/**
 * POST /api/provisioning/jobs/[jobId]/step
 * Traite UN seul élève (le prochain en attente) du job.
 * Appelé en boucle par le client — contourne la limite 60s Vercel Hobby.
 * Retourne { done: true } quand tous les élèves sont traités.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { runProvisioningStep } from "@/src/lib/provisioning-service"

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const { jobId } = await params
  const result = await runProvisioningStep(jobId)
  return NextResponse.json(result)
}
