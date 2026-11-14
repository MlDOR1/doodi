import { prisma } from "@/server/db";
import { ApiError, ok, route } from "@/server/http";
import { altTitlesOf } from "@/server/tmdb";

// One-off: fill alt_titles for movies imported before the column existed. Same CRON_SECRET auth as import-current.
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError(503, "cron_not_configured", "CRON_SECRET is not set");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) throw new ApiError(401, "unauthorized", "Unauthorized");
  const rows = await prisma.movie.findMany({
    where: { tmdbId: { not: null }, altTitles: null, deletedAt: null },
    select: { id: true, tmdbId: true, title: true },
    take: 25,
  });
  let done = 0;
  for (const m of rows) {
    const alt = await altTitlesOf(m.tmdbId!, m.title).catch(() => null);
    if (alt) {
      await prisma.movie.update({ where: { id: m.id }, data: { altTitles: alt } });
      done++;
    }
  }
  return ok({ scanned: rows.length, updated: done });
});
