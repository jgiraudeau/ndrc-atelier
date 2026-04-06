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
  const railwaySecret = process.env.RAILWAY_PROVISIONING_SECRET
  const railwayUrl = process.env.RAILWAY_PROVISIONING_URL

  // Appel interne Vercel → Railway : authentifié par secret, pas de JWT
  const incomingSecret = request.headers.get("x-provisioning-secret")
  if (railwaySecret && incomingSecret === railwaySecret) {
    const body = await request.json() as {
      sourceSubdomain: string
      targetSubdomains: string[]
      cpanelUser: string
    }
    const { runCloneJob } = await import("@/src/lib/clone-service")
    await runCloneJob(body)
    return NextResponse.json({ done: true })
  }

  // Appel navigateur → Vercel : vérification JWT
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const body = await request.json() as {
    sourceSubdomain: string
    targetSubdomains: string[]
    cpanelUser: string
  }

  const { sourceSubdomain, targetSubdomains, cpanelUser } = body
  if (!sourceSubdomain || !targetSubdomains?.length || !cpanelUser) {
    return apiError("sourceSubdomain, targetSubdomains et cpanelUser sont requis")
  }

  // Sur Vercel : déléguer à Railway (fire-and-forget)
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

  // Sans Railway : exécution directe (dev local)
  const { runCloneJob } = await import("@/src/lib/clone-service")
  await runCloneJob({ sourceSubdomain, targetSubdomains, cpanelUser })
  return NextResponse.json({ done: true })
}
