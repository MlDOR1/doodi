import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { prisma } = await import("../src/server/db");
  try {
    const { seedDemoReviews } = await import("./demo-reviews");
    console.log(await seedDemoReviews());
    const reviews = await prisma.review.findMany({
      where: { user: { email: { endsWith: "@reviews.example.test" } }, movie: { deletedAt: null } },
      select: { content: true, hasSpoiler: true, movie: { select: { title: true, posterUrl: true } } },
    });
    console.log({
      storedDemoReviews: reviews.length,
      spoilerReviews: reviews.filter((r) => r.hasSpoiler).length,
      allLabeled: reviews.every((r) => r.content.startsWith("[DEMO /")),
      sampleMovie: reviews[0]?.movie,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Demo review seed failed");
  process.exitCode = 1;
});
