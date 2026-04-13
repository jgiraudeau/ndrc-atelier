import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/src/lib/api-helpers";
import { prisma } from "@/src/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request, ["ADMIN", "TEACHER"]);
    if ("status" in auth && auth.status !== 200) return auth;

    const { id } = await params;

    // Prisma: DocumentChunk has onDelete: Cascade to KnowledgeDocument,
    // so deleting this will intelligently clean up all corresponding chunks.
    await prisma.knowledgeDocument.delete({
      where: { id },
    });

    return apiSuccess({ message: "Document et ses chunks ont été supprimés avec succès." });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return apiError("Le document est introuvable.", 404);
    }
    console.error("Erreur suppression KnowledgeDocument:", error);
    return apiError("Erreur lors de la suppression.", 500);
  }
}
