import { beforeEach, describe, expect, it } from "vitest";
import { GET as getMovie } from "@/app/api/v1/movies/[id]/route";
import { GET as listReviews, POST as postReview } from "@/app/api/v1/movies/[id]/reviews/route";
import { DELETE as deleteReview, PATCH as patchReview } from "@/app/api/v1/reviews/[id]/route";
import { DELETE as removeWatch } from "@/app/api/v1/watchlist/me/[movieId]/route";
import { GET as listWatchlist, POST as addWatch } from "@/app/api/v1/watchlist/me/route";
import { prisma } from "@/server/db";
import { call, makeMovie, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

const reviewPath = (id: number) => `/api/v1/movies/${id}/reviews`;
const good = { rating: 4, content: "หนังสนุกมากครับ", has_spoiler: false };

describe("reviews", () => {
  it("requires login to review (401) and lets a member create one (201) attributed to the session user", async () => {
    const movie = await makeMovie();
    const p = { id: String(movie.id) };
    expect((await call(postReview, "POST", reviewPath(movie.id), p, { body: good })).status).toBe(401);

    const u = await makeUser("u@x.test", "member", "คนรีวิว");
    const res = await call(postReview, "POST", reviewPath(movie.id), p, {
      cookie: u.cookie,
      body: { ...good, user_id: 99999, content: "<script>alert(1)</script> ดีมาก" },
    });
    expect(res.status).toBe(201);
    expect(res.json.data.author).toEqual({ user_id: u.id, display_name: "คนรีวิว" });
    // stored verbatim; the UI renders it as plain text (React escapes), never as HTML
    expect(res.json.data.content).toBe("<script>alert(1)</script> ดีมาก");
  });

  it("allows only one review per user per movie (409), at both API and database level", async () => {
    const movie = await makeMovie();
    const p = { id: String(movie.id) };
    const u = await makeUser("u@x.test");
    expect((await call(postReview, "POST", reviewPath(movie.id), p, { cookie: u.cookie, body: good })).status).toBe(201);
    const dup = await call(postReview, "POST", reviewPath(movie.id), p, { cookie: u.cookie, body: { ...good, rating: 1 } });
    expect(dup.status).toBe(409);
    expect(dup.json.error.code).toBe("review_exists");
    expect(await prisma.review.count()).toBe(1);

    await expect(prisma.review.create({ data: { userId: u.id, movieId: movie.id, rating: 3, content: "ซ้ำ" } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("handles concurrent duplicate submissions without creating two rows", async () => {
    const movie = await makeMovie();
    const p = { id: String(movie.id) };
    const u = await makeUser("u@x.test");
    const results = await Promise.all(
      Array.from({ length: 5 }, () => call(postReview, "POST", reviewPath(movie.id), p, { cookie: u.cookie, body: good })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await prisma.review.count()).toBe(1);
  });

  it("validates rating as a whole number 1-5, in the API and via the database CHECK", async () => {
    const movie = await makeMovie();
    const p = { id: String(movie.id) };
    const u = await makeUser("u@x.test");
    for (const rating of [0, 6, -1, 3.5, "5", null, 1e9]) {
      const r = await call(postReview, "POST", reviewPath(movie.id), p, { cookie: u.cookie, body: { ...good, rating } });
      expect(r.status, `rating ${String(rating)}`).toBe(400);
      expect(r.json.error.fields.rating).toBeTruthy();
    }
    expect((await call(postReview, "POST", reviewPath(movie.id), p, { cookie: u.cookie, body: { ...good, content: "ก" } })).status).toBe(400);
    expect(await prisma.review.count()).toBe(0);

    await expect(prisma.review.create({ data: { userId: u.id, movieId: movie.id, rating: 9, content: "bypass api" } })).rejects.toThrow();
    for (const rating of [1, 5]) {
      const m = await makeMovie(`m${rating}`);
      expect((await call(postReview, "POST", reviewPath(m.id), { id: String(m.id) }, { cookie: u.cookie, body: { ...good, rating } })).status).toBe(201);
    }
  });

  it("recalculates the average and count after create, update and delete", async () => {
    const movie = await makeMovie();
    const p = { id: String(movie.id) };
    const stats = async () => (await call(getMovie, "GET", `/api/v1/movies/${movie.id}`, p)).json.data;
    expect(await stats()).toMatchObject({ average_rating: null, review_count: 0 });

    const [a, b] = await Promise.all([makeUser("a@x.test"), makeUser("b@x.test")]);
    const ra = await call(postReview, "POST", reviewPath(movie.id), p, { cookie: a.cookie, body: { ...good, rating: 5 } });
    await call(postReview, "POST", reviewPath(movie.id), p, { cookie: b.cookie, body: { ...good, rating: 2 } });
    expect(await stats()).toMatchObject({ average_rating: 3.5, review_count: 2 });

    const rid = { id: String(ra.json.data.reviews_id) };
    await call(patchReview, "PATCH", `/api/v1/reviews/${rid.id}`, rid, { cookie: a.cookie, body: { rating: 1 } });
    expect(await stats()).toMatchObject({ average_rating: 1.5, review_count: 2 });

    expect((await call(deleteReview, "DELETE", `/api/v1/reviews/${rid.id}`, rid, { cookie: a.cookie })).status).toBe(204);
    expect(await stats()).toMatchObject({ average_rating: 2, review_count: 1 });
  });

  it("enforces ownership: other members get 403, the owner gets 200/204, an admin may moderate", async () => {
    const movie = await makeMovie();
    const p = { id: String(movie.id) };
    const [owner, intruder, admin] = await Promise.all([makeUser("o@x.test"), makeUser("i@x.test"), makeUser("a@x.test", "admin")]);
    const created = await call(postReview, "POST", reviewPath(movie.id), p, { cookie: owner.cookie, body: good });
    const rid = { id: String(created.json.data.reviews_id) };
    const path = `/api/v1/reviews/${rid.id}`;

    expect((await call(patchReview, "PATCH", path, rid, { body: { rating: 1 } })).status).toBe(401);
    expect((await call(patchReview, "PATCH", path, rid, { cookie: intruder.cookie, body: { rating: 1 } })).status).toBe(403);
    expect((await call(deleteReview, "DELETE", path, rid, { cookie: intruder.cookie })).status).toBe(403);
    expect((await prisma.review.findUniqueOrThrow({ where: { id: Number(rid.id) } })).rating).toBe(4);

    const upd = await call(patchReview, "PATCH", path, rid, { cookie: owner.cookie, body: { rating: 5, content: "แก้ไขแล้วนะ", has_spoiler: true } });
    expect(upd.status).toBe(200);
    expect(upd.json.data).toMatchObject({ rating: 5, content: "แก้ไขแล้วนะ", has_spoiler: true });
    expect((await call(patchReview, "PATCH", path, rid, { cookie: owner.cookie, body: {} })).status).toBe(400);

    const adminEdit = await call(patchReview, "PATCH", path, rid, { cookie: admin.cookie, body: { content: "ลบข้อความไม่เหมาะสม" } });
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.json.data).toMatchObject({ rating: 5, has_spoiler: true });
    expect(adminEdit.json.data.author.user_id).toBe(owner.id);
    expect((await call(deleteReview, "DELETE", path, rid, { cookie: admin.cookie })).status).toBe(204);
    expect((await call(deleteReview, "DELETE", path, rid, { cookie: admin.cookie })).status).toBe(404);
  });

  it("paginates reviews newest first and keeps has_spoiler in the payload", async () => {
    const movie = await makeMovie();
    const p = { id: String(movie.id) };
    const users = await Promise.all(Array.from({ length: 3 }, (_, i) => makeUser(`u${i}@x.test`)));
    for (const [i, u] of users.entries()) {
      await call(postReview, "POST", reviewPath(movie.id), p, { cookie: u.cookie, body: { ...good, has_spoiler: i === 1 } });
    }
    const page1 = await call(listReviews, "GET", reviewPath(movie.id), p, { query: { page_size: 2 } });
    expect(page1.json.meta).toMatchObject({ total: 3, total_pages: 2 });
    expect(page1.json.data.map((r: { has_spoiler: boolean }) => r.has_spoiler)).toEqual([false, true]);
    expect(page1.text).not.toContain("email");
  });
});

describe("watchlist", () => {
  it("requires auth, prevents duplicates (409), lists only my entries and removes (204)", async () => {
    const movie = await makeMovie();
    const [me, other] = await Promise.all([makeUser("me@x.test"), makeUser("o@x.test")]);
    expect((await call(listWatchlist, "GET", "/api/v1/watchlist/me")).status).toBe(401);

    const add = await call(addWatch, "POST", "/api/v1/watchlist/me", {}, { cookie: me.cookie, body: { movie_id: movie.id } });
    expect(add.status).toBe(201);
    const dup = await call(addWatch, "POST", "/api/v1/watchlist/me", {}, { cookie: me.cookie, body: { movie_id: movie.id } });
    expect(dup.status).toBe(409);
    expect(await prisma.watchlist.count()).toBe(1);

    const racing = await Promise.all(
      Array.from({ length: 4 }, () => call(addWatch, "POST", "/api/v1/watchlist/me", {}, { cookie: other.cookie, body: { movie_id: movie.id } })),
    );
    expect(racing.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await prisma.watchlist.count()).toBe(2);

    const mine = await call(listWatchlist, "GET", "/api/v1/watchlist/me", {}, { cookie: me.cookie });
    expect(mine.json.data).toHaveLength(1);
    expect(mine.json.meta.total).toBe(1);

    expect((await call(addWatch, "POST", "/api/v1/watchlist/me", {}, { cookie: me.cookie, body: { movie_id: 987654 } })).status).toBe(404);
    expect((await call(addWatch, "POST", "/api/v1/watchlist/me", {}, { cookie: me.cookie, body: { movie_id: "x" } })).status).toBe(400);

    const mp = { movieId: String(movie.id) };
    const del = await call(removeWatch, "DELETE", `/api/v1/watchlist/me/${movie.id}`, mp, { cookie: me.cookie });
    expect(del.status).toBe(204);
    expect(del.text).toBe("");
    expect((await call(removeWatch, "DELETE", `/api/v1/watchlist/me/${movie.id}`, mp, { cookie: me.cookie })).status).toBe(404);
    expect(await prisma.watchlist.count()).toBe(1);
  });
});
