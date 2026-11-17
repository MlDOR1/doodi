import { beforeEach, expect, it } from "vitest";
import { seedDemoReviews } from "../prisma/demo-reviews";
import { prisma } from "@/server/db";
import { getMovie } from "@/server/movies";
import { makeMovie, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

it("stores labeled demo reviews idempotently, preserves real reviews, and excludes deleted movies", async () => {
  const movie = await makeMovie("Imported", { tmdbId: 42 });
  await makeMovie("Deleted", { tmdbId: 43, deletedAt: new Date() });
  const user = await makeUser("real@example.test");
  await prisma.review.create({ data: { userId: user.id, movieId: movie.id, rating: 4, content: "Real review" } });
  expect(await seedDemoReviews()).toEqual({ movies: 1, demoReviewPairs: 3 });
  await seedDemoReviews();
  expect(await prisma.review.count()).toBe(4);
  const demos = await prisma.review.findMany({ where: { userId: { not: user.id } }, include: { user: true } });
  expect(demos.every((r) => r.content.startsWith("[DEMO /") && r.user.displayName.endsWith("(Demo)"))).toBe(true);
  expect(demos.some((r) => r.hasSpoiler)).toBe(true);
  expect(await prisma.review.findUnique({ where: { userId_movieId: { userId: user.id, movieId: movie.id } } })).toMatchObject({ content: "Real review", rating: 4 });
  expect(await getMovie(movie.id)).toMatchObject({ review_count: 4, average_rating: 3.5 });
});
