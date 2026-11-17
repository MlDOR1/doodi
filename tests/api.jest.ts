import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { GET as movies } from "@/app/api/v1/movies/route";
import { POST as createReview } from "@/app/api/v1/movies/[id]/reviews/route";
import { PATCH as updateReview, DELETE as deleteReview } from "@/app/api/v1/reviews/[id]/route";
import { prisma } from "@/server/db";
import { call, makeMovie, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const reviewInput = { rating: 4, content: "หนังสนุกและเล่าเรื่องได้น่าสนใจ", has_spoiler: false };

describe("DOODI core APIs", () => {
  it("POST /auth/login accepts valid credentials, sets a session cookie, and rejects an incorrect password", async () => {
    await makeUser("member@example.test");

    const valid = await call(login, "POST", "/api/v1/auth/login", {}, {
      body: { email: "member@example.test", password: "password123" },
    });
    expect(valid.status).toBe(200);
    expect(valid.headers.get("set-cookie")).toMatch(/doodi_session=.*HttpOnly/);
    expect(valid.json.data).toMatchObject({ email: "member@example.test", role: "member" });
    expect(valid.json.data).not.toHaveProperty("password_hash");

    const invalid = await call(login, "POST", "/api/v1/auth/login", {}, {
      body: { email: "member@example.test", password: "incorrect-password" },
    });
    expect(invalid.status).toBe(401);
    expect(invalid.json.error.code).toBe("invalid_credentials");
  });

  it("GET /movies returns visible movies with review statistics and validates query parameters", async () => {
    const movie = await makeMovie("Inception");
    await makeMovie("Deleted", { deletedAt: new Date() });
    const user = await makeUser("reviewer@example.test");
    await prisma.review.create({ data: { userId: user.id, movieId: movie.id, rating: 4, content: "A review" } });

    const response = await call(movies, "GET", "/api/v1/movies");
    expect(response.status).toBe(200);
    expect(response.json.data).toHaveLength(1);
    expect(response.json.data[0]).toMatchObject({ movie_id: movie.id, title: "Inception", average_rating: 4, review_count: 1 });
    expect(response.json.meta.total).toBe(1);
    expect((await call(movies, "GET", "/api/v1/movies", {}, { query: { page_size: 51 } })).status).toBe(400);
  });

  it("POST /movies/:id/reviews requires login, validates input, stores the session author, and rejects duplicates", async () => {
    const movie = await makeMovie();
    const user = await makeUser("author@example.test");
    const path = `/api/v1/movies/${movie.id}/reviews`;
    const params = { id: String(movie.id) };

    expect((await call(createReview, "POST", path, params, { body: reviewInput })).status).toBe(401);
    expect((await call(createReview, "POST", path, params, { cookie: user.cookie, body: { ...reviewInput, rating: 6 } })).status).toBe(400);

    const created = await call(createReview, "POST", path, params, {
      cookie: user.cookie, body: { ...reviewInput, user_id: 999999 },
    });
    expect(created.status).toBe(201);
    expect(await prisma.review.findUnique({ where: { id: created.json.data.reviews_id } })).toMatchObject({
      userId: user.id, movieId: movie.id, rating: 4, content: reviewInput.content,
    });
    expect((await call(createReview, "POST", path, params, { cookie: user.cookie, body: reviewInput })).status).toBe(409);
    expect(await prisma.review.count()).toBe(1);
  });

  it("PATCH /reviews/:id blocks other members and persists the owner's update", async () => {
    const movie = await makeMovie();
    const owner = await makeUser("owner@example.test");
    const other = await makeUser("other@example.test");
    const review = await prisma.review.create({ data: { userId: owner.id, movieId: movie.id, rating: 4, content: "Original review" } });
    const path = `/api/v1/reviews/${review.id}`;
    const params = { id: String(review.id) };

    expect((await call(updateReview, "PATCH", path, params, { cookie: other.cookie, body: { rating: 1 } })).status).toBe(403);
    expect((await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).rating).toBe(4);

    const updated = await call(updateReview, "PATCH", path, params, {
      cookie: owner.cookie, body: { rating: 5, content: "Updated review", has_spoiler: true },
    });
    expect(updated.status).toBe(200);
    expect(await prisma.review.findUnique({ where: { id: review.id } })).toMatchObject({
      rating: 5, content: "Updated review", hasSpoiler: true, userId: owner.id,
    });
  });

  it("DELETE /reviews/:id blocks other members and removes the owner's review", async () => {
    const movie = await makeMovie();
    const owner = await makeUser("owner@example.test");
    const other = await makeUser("other@example.test");
    const review = await prisma.review.create({ data: { userId: owner.id, movieId: movie.id, rating: 4, content: "Review to delete" } });
    const path = `/api/v1/reviews/${review.id}`;
    const params = { id: String(review.id) };

    expect((await call(deleteReview, "DELETE", path, params, { cookie: other.cookie })).status).toBe(403);
    expect(await prisma.review.findUnique({ where: { id: review.id } })).not.toBeNull();

    const removed = await call(deleteReview, "DELETE", path, params, { cookie: owner.cookie });
    expect(removed.status).toBe(204);
    expect(removed.text).toBe("");
    expect(await prisma.review.findUnique({ where: { id: review.id } })).toBeNull();
  });
});
