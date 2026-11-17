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

const round2 = (n: number) => Math.round(n * 100) / 100;

function toMovieDTO(m: MovieRow, stats?: { avg: number | null; count: number }): MovieDTO {
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

async function statsFor(movieIds: number[]) {
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

const movieColumns = Prisma.sql`
  m.movie_id AS id, m.tmdb_id AS tmdbId, m.title, m.synopsis, m.genre,
  m.release_year AS releaseYear, m.poster_url AS posterUrl, m.created_at AS createdAt
`;

const reviewStats = Prisma.sql`
  SELECT movie_id, AVG(rating) AS average_rating, COUNT(*) AS review_count
  FROM reviews
  GROUP BY movie_id
`;

const movieSorts = {
  newest: Prisma.sql`m.created_at DESC, m.movie_id DESC`,
  top_rated: Prisma.sql`r.average_rating DESC, r.review_count DESC, m.movie_id DESC`,
  most_reviewed: Prisma.sql`COALESCE(r.review_count, 0) DESC, r.average_rating DESC, m.movie_id DESC`,
};

type RatedMovieRow = MovieRow & {
  average_rating: Prisma.Decimal | null;
  review_count: bigint | null;
};

function toRatedMovieDTO(movie: RatedMovieRow): MovieDTO {
  return toMovieDTO(movie, {
    avg: movie.average_rating === null ? null : round2(Number(movie.average_rating)),
    count: Number(movie.review_count ?? 0),
  });
}

export interface ListParams {
  q?: string;
  genre?: string;
  year?: number;
  sort: Sort;
  page: number;
  page_size: number;
}

export async function listMovies(params: ListParams) {
  const filters = [Prisma.sql`m.deleted_at IS NULL`];
  if (params.q) {
    const pattern = `%${escapeLike(params.q)}%`;
    filters.push(Prisma.sql`(m.title LIKE ${pattern} OR m.alt_titles LIKE ${pattern})`);
  }
  if (params.genre) filters.push(Prisma.sql`FIND_IN_SET(${params.genre}, m.genre) > 0`);
  if (params.year) filters.push(Prisma.sql`m.release_year = ${params.year}`);

  const where = Prisma.join(filters, " AND ");
  const offset = (params.page - 1) * params.page_size;
  const [movies, [count]] = await Promise.all([
    prisma.$queryRaw<RatedMovieRow[]>`
      SELECT ${movieColumns}, r.average_rating, r.review_count
      FROM movies m
      LEFT JOIN (${reviewStats}) r ON r.movie_id = m.movie_id
      WHERE ${where}
      ORDER BY ${movieSorts[params.sort]}
      LIMIT ${params.page_size} OFFSET ${offset}
    `,
    prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total FROM movies m WHERE ${where}`,
  ]);

  return {
    items: movies.map(toRatedMovieDTO),
    meta: pageMeta(params.page, params.page_size, Number(count.total)),
  };
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

export async function featuredMovies(limit = 6) {
  const movies = await prisma.$queryRaw<RatedMovieRow[]>`
    SELECT ${movieColumns}, r.average_rating, r.review_count
    FROM movies m
    JOIN (${reviewStats}) r ON r.movie_id = m.movie_id
    WHERE m.deleted_at IS NULL
    ORDER BY ${movieSorts.top_rated}
    LIMIT ${limit}
  `;
  return movies.map(toRatedMovieDTO);
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
  const res = await prisma.movie.updateMany({
    where: { id, deletedAt: null },
    data: {
      title: input.title,
      synopsis: input.synopsis,
      genre: input.genre,
      releaseYear: input.release_year,
      posterUrl: input.poster_url,
    },
  });
  if (res.count === 0) throw new ApiError(404, "movie_not_found", "ไม่พบหนังเรื่องนี้");
  return getMovieOr404(id);
}

export async function softDeleteMovie(id: number) {
  const res = await prisma.movie.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (res.count === 0) throw new ApiError(404, "movie_not_found", "ไม่พบหนังเรื่องนี้");
}
