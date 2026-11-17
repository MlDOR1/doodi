import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { prisma } = await import("../src/server/db");
  try {
    const { importCurrent } = await import("../src/server/tmdb");
    const result = await importCurrent();
    console.log(JSON.stringify(result, null, 2));
    if (result.failed.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Movie import failed");
  process.exitCode = 1;
});
