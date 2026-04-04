import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"
import { SiteStatus } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireAuth(request, ["TEACHER", "ADMIN"])
  if (auth instanceof NextResponse) return auth

  const { jobId } = await params

  const job = await prisma.provisioningJob.findFirst({
    where: {
      id: jobId,
      ...(auth.payload.role === "TEACHER" ? { teacherId: auth.payload.sub } : {}),
    },
  })
  if (!job) return apiError("Job introuvable", 404)
  if (job.status === "COMPLETED") return apiError("Job déjà terminé", 400)

  await prisma.site.updateMany({
    where: { provisioningJobId: jobId, status: { in: [SiteStatus.CREATING, SiteStatus.PENDING] } },
    data: { status: SiteStatus.ERROR },
  })

  await prisma.provisioningJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      log: { push: `[${new Date().toISOString()}] Job annulé manuellement.` },
    },
  })

  return NextResponse.json({ ok: true })
}
