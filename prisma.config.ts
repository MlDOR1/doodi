import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: {
    // `prisma generate` (npm postinstall) runs before .env exists; migrate commands do need the real URL.
    url: process.env.DATABASE_URL ?? "mysql://unset:unset@localhost:3306/unset",
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
