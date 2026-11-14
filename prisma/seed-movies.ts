import "dotenv/config";
import movies from "./seed-data/movies.json";
import { prisma } from "../src/server/db";

// Catalog only: no users, no reviews. Safe for a real deployment. Idempotent.
async function main() {
  for (const m of movies) {
    const data = { title: m.title, synopsis: m.synopsis, genre: m.genre, releaseYear: m.release_year, posterUrl: m.poster_url };
    await prisma.movie.upsert({ where: { tmdbId: m.tmdb_id }, create: { tmdbId: m.tmdb_id, ...data }, update: data });
  }
  console.log(`Seeded ${movies.length} movies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
