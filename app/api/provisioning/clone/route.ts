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
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const body = await request.json() as {
    sourceSubdomain: string   // ex: "modelewp1"
    targetSubdomains: string[] // ex: ["wp1", "wp2", "wp3"]
    cpanelUser: string
  }

  const { sourceSubdomain, targetSubdomains, cpanelUser } = body
  if (!sourceSubdomain || !targetSubdomains?.length || !cpanelUser) {
    return apiError("sourceSubdomain, targetSubdomains et cpanelUser sont requis")
  }

  const railwayUrl = process.env.RAILWAY_PROVISIONING_URL
  const railwaySecret = process.env.RAILWAY_PROVISIONING_SECRET

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

  // Sur Railway : exécution réelle
  const secret = process.env.RAILWAY_PROVISIONING_SECRET
  if (secret) {
    const incoming = request.headers.get("x-provisioning-secret") ?? ""
    if (incoming !== secret) return apiError("Non autorisé", 401)
  }

  const { runCloneJob } = await import("@/src/lib/clone-service")
  await runCloneJob({ sourceSubdomain, targetSubdomains, cpanelUser })

  return NextResponse.json({ done: true })
}
