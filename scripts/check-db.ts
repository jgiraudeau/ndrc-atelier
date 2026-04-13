import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const chunks = await prisma.documentChunk.groupBy({
    by: ['source'],
    _count: { id: true }
  });
  console.log("Indexed sources in DB:");
  chunks.forEach(c => console.log(`- ${c.source}: ${c._count.id} chunks`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
