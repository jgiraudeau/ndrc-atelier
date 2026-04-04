import { NextRequest, NextResponse } from "next/server"
import { requireAuth, apiError } from "@/src/lib/api-helpers"
import { prisma } from "@/src/lib/prisma"

export async function DELETE(
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
  if (job.status === "RUNNING") return apiError("Impossible de supprimer un job en cours. Annulez-le d'abord.", 400)

  await prisma.provisioningJob.delete({ where: { id: jobId } })
  return NextResponse.json({ ok: true })
}
