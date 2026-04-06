/**
 * POST /api/provisioning/install
 * Installe WP ou PS sur une liste de sous-domaines.
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
    subdomains: string[]
    cpanelUser: string
    siteType: "WORDPRESS" | "PRESTASHOP"
  }

  const { subdomains, cpanelUser, siteType } = body
  if (!subdomains?.length || !cpanelUser || !siteType) {
    return apiError("subdomains, cpanelUser et siteType sont requis")
  }

  // Sur Vercel : déléguer à Railway
  if (railwayUrl && railwaySecret) {
    waitUntil(
      fetch(`${railwayUrl}/api/provisioning/install`, {
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

  const { runInstallJob } = await import("@/src/lib/install-service")
  await runInstallJob({ subdomains, cpanelUser, siteType })

  return NextResponse.json({ done: true })
}
