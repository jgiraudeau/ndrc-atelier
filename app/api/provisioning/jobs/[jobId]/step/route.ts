/**
 * POST /api/provisioning/jobs/[jobId]/step
 *
 * Sur Vercel : fire-and-forget vers Railway (qui n'a pas de limite 60s),
 * retourne immédiatement { done: false }. Le client poll le statut en DB.
 *
 * Sur Railway : exécute TOUS les élèves restants d'un coup, met à jour la DB.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { runProvisioningStep } from "@/src/lib/provisioning-service"
import { waitUntil } from "@vercel/functions"

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params

  const railwayUrl = process.env.RAILWAY_PROVISIONING_URL
  const railwaySecret = process.env.RAILWAY_PROVISIONING_SECRET

  // ── Sur Vercel : fire-and-forget vers Railway ────────────────────────────
  if (railwayUrl && railwaySecret) {
    const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
    if (auth instanceof NextResponse) return auth

    waitUntil(
      fetch(`${railwayUrl}/api/provisioning/jobs/${jobId}/step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-provisioning-secret": railwaySecret,
        },
      })
    )

    // Répond immédiatement — le client poll le statut DB toutes les 3s
    return NextResponse.json({ done: false })
  }

  // ── Sur Railway : vérifier le secret puis traiter tous les élèves ────────
  if (railwaySecret) {
    const incoming = request.headers.get("x-provisioning-secret") ?? ""
    if (incoming !== railwaySecret) return apiError("Non autorisé", 401)
  }

  // Boucle sur tous les élèves restants (pas de limite de temps sur Railway)
  console.log(`[provision] Démarrage job ${jobId}`)
  let done = false
  let step = 0
  try {
    while (!done) {
      step++
      console.log(`[provision] Step ${step} pour job ${jobId}`)
      const result = await runProvisioningStep(jobId)
      console.log(`[provision] Step ${step} résultat:`, JSON.stringify(result))
      done = result.done
    }
    // Appel de finalisation : met le job en COMPLETED/FAILED/PARTIAL en DB
    await runProvisioningStep(jobId)
    console.log(`[provision] Job ${jobId} terminé en ${step} steps`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[provision] ERREUR FATALE job ${jobId} step ${step}:`, msg, err)
  }

  return NextResponse.json({ done: true })
}
