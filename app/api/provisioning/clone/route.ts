/**
 * POST /api/provisioning/clone
 * Clone un site modèle vers une liste de sous-domaines cibles.
 * Délègue à Railway si RAILWAY_PROVISIONING_URL est défini.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { waitUntil } from "@vercel/functions"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const railwayUrl = process.env.RAILWAY_PROVISIONING_URL
  const railwaySecret = process.env.RAILWAY_PROVISIONING_SECRET

  // Sur Railway : vérifier le secret en premier (pas de JWT dans ces requêtes)
  if (!railwayUrl && railwaySecret) {
    const incoming = request.headers.get("x-provisioning-secret") ?? ""
    if (incoming !== railwaySecret) return apiError("Non autorisé", 401)
  } else {
    // Sur Vercel : vérifier le JWT
    const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
    if (auth instanceof NextResponse) return auth
  }

  const body = await request.json() as {
    sourceSubdomain: string
    targetSubdomains: string[]
    cpanelUser: string
  }

  const { sourceSubdomain, targetSubdomains, cpanelUser } = body
  if (!sourceSubdomain || !targetSubdomains?.length || !cpanelUser) {
    return apiError("sourceSubdomain, targetSubdomains et cpanelUser sont requis")
  }

  // Sur Vercel : déléguer à Railway
  if (railwayUrl && railwaySecret) {
    waitUntil(
      fetch(`${railwayUrl}/api/provisioning/clone`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-provisioning-secret": railwaySecret,
        },
        body: JSON.stringify(body),
      })
    )
    return NextResponse.json({ started: true })
  }

  const { runCloneJob } = await import("@/src/lib/clone-service")
  await runCloneJob({ sourceSubdomain, targetSubdomains, cpanelUser })

  return NextResponse.json({ done: true })
}
