/**
 * POST /api/provisioning/jobs/[jobId]/step
 * Traite UN seul élève (le prochain en attente) du job.
 * Appelé en boucle par le client — contourne la limite 60s Vercel Hobby.
 *
 * Si RAILWAY_PROVISIONING_URL est défini (Vercel) : délègue à Railway.
 * Sinon (Railway) : exécute le provisioning réel via WHM/Softaculous.
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

  // Sur Vercel : déléguer à Railway qui a accès au WHM
  const railwayUrl = process.env.RAILWAY_PROVISIONING_URL
  const railwaySecret = process.env.RAILWAY_PROVISIONING_SECRET
  if (railwayUrl && railwaySecret) {
    const res = await fetch(`${railwayUrl}/api/provisioning/jobs/${jobId}/step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-provisioning-secret": railwaySecret,
      },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  }

  // Sur Railway : exécution réelle
  const secret = process.env.RAILWAY_PROVISIONING_SECRET
  if (secret) {
    const incoming = request.headers.get("x-provisioning-secret") ?? ""
    if (incoming !== secret) return apiError("Non autorisé", 401)
  }

  const result = await runProvisioningStep(jobId)
  return NextResponse.json(result)
}
