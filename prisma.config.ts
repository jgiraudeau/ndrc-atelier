import "dotenv/config";
import { defineConfig } from "prisma/config";

// En local : utilise DATABASE_PUBLIC_URL (accès externe Railway)
// En production (Railway/Vercel) : utilise DATABASE_URL (réseau interne)
const databaseUrl =
  process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
