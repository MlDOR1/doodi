import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { ApiError, pageMeta } from "./http";
import type { MovieDTO, Sort } from "@/lib/types";

type MovieRow = {
  id: number;
  tmdbId: number | null;
  title: string;
  synopsis: string | null;
  genre: string | null;
  releaseYear: number | null;
  posterUrl: string | null;
  createdAt: Date;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function toMovieDTO(m: MovieRow, stats?: { avg: number | null; count: number }): MovieDTO {
  return {
    movie_id: m.id,
    tmdb_id: m.tmdbId,
    title: m.title,
    synopsis: m.synopsis,
    genre: m.genre,
    release_year: m.releaseYear,
    poster_url: m.posterUrl,
    created_at: m.createdAt.toISOString(),
    average_rating: stats?.avg ?? null,
    review_count: stats?.count ?? 0,
  };
}

export async function statsFor(movieIds: number[]) {
  const map = new Map<number, { avg: number | null; count: number }>();
  if (movieIds.length === 0) return map;
  const rows = await prisma.review.groupBy({
    by: ["movieId"],
    where: { movieId: { in: movieIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const r of rows) {
    map.set(r.movieId, { avg: r._avg.rating === null ? null : round2(r._avg.rating), count: r._count._all });
  }
  return map;
}

export async function withStats(rows: MovieRow[]): Promise<MovieDTO[]> {
  const stats = await statsFor(rows.map((r) => r.id));
  return rows.map((r) => toMovieDTO(r, stats.get(r.id)));
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface ListParams {
  q?: string;
  genre?: string;
  year?: number;
  sort: Sort;
  page: number;
  page_size: number;
}

export async function listMovies(p: ListParams) {
  const conds: Prisma.Sql[] = [Prisma.sql`m.deleted_at IS NULL`];
  if (p.q) {
    const like = `%${escapeLike(p.q)}%`;
    conds.push(Prisma.sql`(m.title LIKE ${like} OR m.alt_titles LIKE ${like})`);
  }
  if (p.genre) conds.push(Prisma.sql`FIND_IN_SET(${p.genre}, m.genre) > 0`);
  if (p.year) conds.push(Prisma.sql`m.release_year = ${p.year}`);
  const where = Prisma.join(conds, " AND ");

  const order =
    p.sort === "top_rated"
      ? Prisma.sql`r.avg_rating IS NULL, r.avg_rating DESC, r.cnt DESC, m.movie_id DESC`
      : p.sort === "most_reviewed"
        ? Prisma.sql`COALESCE(r.cnt, 0) DESC, r.avg_rating DESC, m.movie_id DESC`
        : Prisma.sql`m.created_at DESC, m.movie_id DESC`;

  const from = Prisma.sql`FROM movies m LEFT JOIN (
      SELECT movie_id, AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM reviews GROUP BY movie_id
    ) r ON r.movie_id = m.movie_id WHERE ${where}`;

  const [idRows, totalRows] = await Promise.all([
    prisma.$queryRaw<{ movie_id: number }[]>(
      Prisma.sql`SELECT m.movie_id ${from} ORDER BY ${order} LIMIT ${p.page_size} OFFSET ${(p.page - 1) * p.page_size}`,
    ),
    prisma.$queryRaw<{ total: bigint | number }[]>(Prisma.sql`SELECT COUNT(*) AS total ${from}`),
  ]);
  const total = Number(totalRows[0]?.total ?? 0);
  const ids = idRows.map((r) => Number(r.movie_id));

  const rows = await prisma.movie.findMany({ where: { id: { in: ids }, deletedAt: null } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
  return { items: await withStats(ordered), meta: pageMeta(p.page, p.page_size, total) };
}

export async function getMovie(id: number): Promise<MovieDTO | null> {
  const m = await prisma.movie.findFirst({ where: { id, deletedAt: null } });
  if (!m) return null;
  const stats = await statsFor([id]);
  return toMovieDTO(m, stats.get(id));
}

export async function getMovieOr404(id: number) {
  const m = await getMovie(id);
  if (!m) throw new ApiError(404, "movie_not_found", "ไม่พบหนังเรื่องนี้");
  return m;
}

/** Highest rated movies that actually have reviews, for the homepage. */
export async function featuredMovies(limit = 6) {
  const ids = await prisma.$queryRaw<{ movie_id: number }[]>(Prisma.sql`
    SELECT m.movie_id FROM movies m
    JOIN (SELECT movie_id, AVG(rating) AS a, COUNT(*) AS c FROM reviews GROUP BY movie_id) r ON r.movie_id = m.movie_id
    WHERE m.deleted_at IS NULL
    ORDER BY r.a DESC, r.c DESC, m.movie_id DESC LIMIT ${limit}`);
  const order = ids.map((r) => Number(r.movie_id));
  const rows = await prisma.movie.findMany({ where: { id: { in: order }, deletedAt: null } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return withStats(order.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r));
}

export async function filterOptions() {
  const [genreRows, yearRows] = await Promise.all([
    prisma.movie.findMany({ where: { deletedAt: null, genre: { not: null } }, select: { genre: true }, distinct: ["genre"] }),
    prisma.movie.findMany({
      where: { deletedAt: null, releaseYear: { not: null } },
      select: { releaseYear: true },
      distinct: ["releaseYear"],
      orderBy: { releaseYear: "desc" },
    }),
  ]);
  const genres = new Set<string>();
  for (const r of genreRows) for (const g of r.genre?.split(",") ?? []) if (g) genres.add(g);
  return {
    genres: [...genres].sort((a, b) => a.localeCompare(b, "th")),
    years: yearRows.map((r) => r.releaseYear as number),
  };
}

export interface MovieInput {
  title: string;
  synopsis?: string | null;
  genre?: string | null;
  release_year?: number | null;
  poster_url?: string | null;
  tmdb_id?: number | null;
  alt_titles?: string | null;
}

export async function createMovie(input: MovieInput) {
  const m = await prisma.movie.create({
    data: {
      title: input.title,
      synopsis: input.synopsis ?? null,
      genre: input.genre ?? null,
      releaseYear: input.release_year ?? null,
      posterUrl: input.poster_url ?? null,
      tmdbId: input.tmdb_id ?? null,
      altTitles: input.alt_titles ?? null,
    },
  });
  return toMovieDTO(m);
}

export async function updateMovie(id: number, input: Partial<MovieInput>) {
  await getMovieOr404(id);
  const data: Prisma.MovieUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.synopsis !== undefined) data.synopsis = input.synopsis;
  if (input.genre !== undefined) data.genre = input.genre;
  if (input.release_year !== undefined) data.releaseYear = input.release_year;
  if (input.poster_url !== undefined) data.posterUrl = input.poster_url;
  // updateMany keeps the soft-delete guard atomic with the write
  const res = await prisma.movie.updateMany({ where: { id, deletedAt: null }, data: data as Prisma.MovieUpdateManyMutationInput });
  if (res.count === 0) throw new ApiError(404, "movie_not_found", "ไม่พบหนังเรื่องนี้");
  return getMovieOr404(id);
}

export async function softDeleteMovie(id: number) {
  const res = await prisma.movie.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (res.count === 0) throw new ApiError(404, "movie_not_found", "ไม่พบหนังเรื่องนี้");
}
