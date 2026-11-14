import { prisma } from "./db";
import { ApiError, isForeignKeyViolation, isUniqueViolation, pageMeta } from "./http";
import { getMovieOr404, withStats } from "./movies";

export async function listWatchlist(userId: number, page: number, pageSize: number) {
  const where = { userId, movie: { deletedAt: null } };
  const [rows, total] = await Promise.all([
    prisma.watchlist.findMany({
      where,
      include: { movie: true },
      orderBy: [{ createdAt: "desc" }, { movieId: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.watchlist.count({ where }),
  ]);
  const movies = await withStats(rows.map((r) => r.movie));
  const items = rows.map((r, i) => ({ ...movies[i], added_at: r.createdAt.toISOString() }));
  return { items, meta: pageMeta(page, pageSize, total) };
}

export async function isInWatchlist(userId: number, movieId: number) {
  return (await prisma.watchlist.findUnique({ where: { userId_movieId: { userId, movieId } } })) !== null;
}

export async function addToWatchlist(userId: number, movieId: number) {
  await getMovieOr404(movieId);
  try {
    const w = await prisma.watchlist.create({ data: { userId, movieId } });
    return { movie_id: w.movieId, added_at: w.createdAt.toISOString() };
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "already_in_watchlist", "หนังเรื่องนี้อยู่ในรายการอยากดูแล้ว");
    if (isForeignKeyViolation(e)) throw new ApiError(404, "movie_not_found", "ไม่พบหนังเรื่องนี้");
    throw e;
  }
}

export async function removeFromWatchlist(userId: number, movieId: number) {
  const res = await prisma.watchlist.deleteMany({ where: { userId, movieId } });
  if (res.count === 0) throw new ApiError(404, "not_in_watchlist", "ไม่พบหนังเรื่องนี้ในรายการอยากดู");
}
