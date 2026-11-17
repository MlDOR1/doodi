import { prisma } from "./db";
import { ApiError, isForeignKeyViolation, isUniqueViolation, pageMeta } from "./http";
import { getMovieOr404 } from "./movies";
import type { ReviewDTO, UserDTO } from "@/lib/types";

const include = { user: { select: { id: true, displayName: true } } } as const;

type Row = {
  id: number;
  movieId: number;
  rating: number;
  content: string;
  hasSpoiler: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { id: number; displayName: string };
};

export const toReviewDTO = (r: Row): ReviewDTO => ({
  reviews_id: r.id,
  movie_id: r.movieId,
  rating: r.rating,
  content: r.content,
  has_spoiler: r.hasSpoiler,
  created_at: r.createdAt.toISOString(),
  updated_at: r.updatedAt.toISOString(),
  author: { user_id: r.user.id, display_name: r.user.displayName },
});

export async function listReviews(movieId: number, page: number, pageSize: number) {
  await getMovieOr404(movieId);
  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where: { movieId },
      include,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.review.count({ where: { movieId } }),
  ]);
  return { items: rows.map(toReviewDTO), meta: pageMeta(page, pageSize, total) };
}

export async function getMyReview(userId: number, movieId: number) {
  const r = await prisma.review.findUnique({ where: { userId_movieId: { userId, movieId } }, include });
  return r ? toReviewDTO(r) : null;
}

export async function createReview(
  user: UserDTO,
  movieId: number,
  input: { rating: number; content: string; has_spoiler: boolean },
) {
  await getMovieOr404(movieId);
  try {
    const r = await prisma.review.create({
      data: { userId: user.user_id, movieId, rating: input.rating, content: input.content, hasSpoiler: input.has_spoiler },
      include,
    });
    return toReviewDTO(r);
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "review_exists", "คุณรีวิวหนังเรื่องนี้ไปแล้ว แก้ไขรีวิวเดิมได้เลย");
    // movie hard-removed between check and insert
    if (isForeignKeyViolation(e)) throw new ApiError(404, "movie_not_found", "ไม่พบหนังเรื่องนี้");
    throw e;
  }
}

/** Loads a review and enforces: movie not soft-deleted, caller is owner or admin. */
async function loadOwned(user: UserDTO, reviewId: number) {
  const r = await prisma.review.findFirst({ where: { id: reviewId, movie: { deletedAt: null } }, include });
  if (!r) throw new ApiError(404, "review_not_found", "ไม่พบรีวิวนี้");
  if (r.userId !== undefined && r.user.id !== user.user_id && user.role !== "admin") {
    throw new ApiError(403, "forbidden", "คุณไม่มีสิทธิ์จัดการรีวิวนี้");
  }
  return r;
}

export async function updateReview(
  user: UserDTO,
  reviewId: number,
  input: { rating?: number; content?: string; has_spoiler?: boolean },
) {
  await loadOwned(user, reviewId);
  const r = await prisma.review.update({
    where: { id: reviewId },
    data: {
      rating: input.rating,
      content: input.content,
      hasSpoiler: input.has_spoiler,
    },
    include,
  });
  return toReviewDTO(r);
}

export async function deleteReview(user: UserDTO, reviewId: number) {
  await loadOwned(user, reviewId);
  await prisma.review.deleteMany({ where: { id: reviewId } });
}

/** Admin moderation list across all visible movies. */
export async function listAllReviews(q: string | undefined, page: number, pageSize: number) {
  const where = {
    movie: { deletedAt: null, ...(q ? { title: { contains: q } } : {}) },
  };
  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { ...include, movie: { select: { id: true, title: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.review.count({ where }),
  ]);
  return {
    items: rows.map((r) => ({ ...toReviewDTO(r), movie_title: r.movie.title })),
    meta: pageMeta(page, pageSize, total),
  };
}
