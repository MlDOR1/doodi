import { beforeEach, describe, expect, it } from "vitest";
import { GET as listMovies, POST as createMovie } from "@/app/api/v1/movies/route";
import { DELETE as deleteMovie, GET as getMovie, PATCH as patchMovie } from "@/app/api/v1/movies/[id]/route";
import { GET as listReviews, POST as postReview } from "@/app/api/v1/movies/[id]/reviews/route";
import { GET as listWatchlist, POST as addWatch } from "@/app/api/v1/watchlist/me/route";
import { GET as tmdbSearch } from "@/app/api/v1/admin/tmdb/search/route";
import { POST as tmdbImport } from "@/app/api/v1/admin/tmdb/import/route";
import { listAllReviews } from "@/server/reviews";
import { prisma } from "@/server/db";
import { call, makeMovie, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("admin authorization", () => {
  it("blocks guests (401) and members (403) from every admin mutation", async () => {
    const member = await makeUser("m@x.test");
    const movie = await makeMovie();
    const id = { id: String(movie.id) };
    const attempts = [
      () => call(createMovie, "POST", "/api/v1/movies", {}, { body: { title: "X" }, ...{} }),
      () => call(patchMovie, "PATCH", `/api/v1/movies/${movie.id}`, id, { body: { title: "Y" } }),
      () => call(deleteMovie, "DELETE", `/api/v1/movies/${movie.id}`, id),
      () => call(tmdbSearch, "GET", "/api/v1/admin/tmdb/search", {}, { query: { query: "a" } }),
      () => call(tmdbImport, "POST", "/api/v1/admin/tmdb/import", {}, { body: { tmdb_id: 1 } }),
    ];
    for (const attempt of attempts) expect((await attempt()).status).toBe(401);

    const asMember = [
      call(createMovie, "POST", "/api/v1/movies", {}, { cookie: member.cookie, body: { title: "X" } }),
      call(patchMovie, "PATCH", `/api/v1/movies/${movie.id}`, id, { cookie: member.cookie, body: { title: "Y" } }),
      call(deleteMovie, "DELETE", `/api/v1/movies/${movie.id}`, id, { cookie: member.cookie }),
      call(tmdbSearch, "GET", "/api/v1/admin/tmdb/search", {}, { cookie: member.cookie, query: { query: "a" } }),
      call(tmdbImport, "POST", "/api/v1/admin/tmdb/import", {}, { cookie: member.cookie, body: { tmdb_id: 1 } }),
    ];
    for (const r of await Promise.all(asMember)) expect(r.status).toBe(403);
    expect((await prisma.movie.findUniqueOrThrow({ where: { id: movie.id } })).title).toBe("หนังทดสอบ");
  });

  it("lets an admin create, update and soft-delete a movie", async () => {
    const admin = await makeUser("a@x.test", "admin");
    const created = await call(createMovie, "POST", "/api/v1/movies", {}, {
      cookie: admin.cookie,
      body: { title: "  เรื่องใหม่  ", genre: "ดราม่า, ตลก", release_year: 2025, synopsis: "", poster_url: "" },
    });
    expect(created.status).toBe(201);
    expect(created.json.data).toMatchObject({ title: "เรื่องใหม่", genre: "ดราม่า,ตลก", release_year: 2025, synopsis: null, poster_url: null });
    const id = String(created.json.data.movie_id);

    const patched = await call(patchMovie, "PATCH", `/api/v1/movies/${id}`, { id }, { cookie: admin.cookie, body: { title: "ชื่อแก้ไข" } });
    expect(patched.status).toBe(200);
    expect(patched.json.data.title).toBe("ชื่อแก้ไข");

    const bad = await call(patchMovie, "PATCH", `/api/v1/movies/${id}`, { id }, { cookie: admin.cookie, body: { poster_url: "javascript:alert(1)" } });
    expect(bad.status).toBe(400);

    const del = await call(deleteMovie, "DELETE", `/api/v1/movies/${id}`, { id }, { cookie: admin.cookie });
    expect(del.status).toBe(204);
    expect(del.text).toBe("");
    const row = await prisma.movie.findUniqueOrThrow({ where: { id: Number(id) } });
    expect(row.deletedAt).not.toBeNull();

    expect((await call(deleteMovie, "DELETE", `/api/v1/movies/${id}`, { id }, { cookie: admin.cookie })).status).toBe(404);
  });
});

describe("soft-deleted movie visibility", () => {
  it("disappears from catalog, details, reviews, watchlist and review operations but keeps its rows", async () => {
    const admin = await makeUser("a@x.test", "admin");
    const member = await makeUser("m@x.test");
    const movie = await makeMovie("จะถูกลบ");
    const other = await makeMovie("ยังอยู่");
    const id = { id: String(movie.id) };

    const review = await prisma.review.create({ data: { userId: member.id, movieId: movie.id, rating: 4, content: "ดีมากเลย" } });
    await prisma.watchlist.create({ data: { userId: member.id, movieId: movie.id } });
    await prisma.watchlist.create({ data: { userId: member.id, movieId: other.id } });

    await call(deleteMovie, "DELETE", `/api/v1/movies/${movie.id}`, id, { cookie: admin.cookie });

    const list = await call(listMovies, "GET", "/api/v1/movies", {}, { query: { q: "จะถูกลบ" } });
    expect(list.json.data).toHaveLength(0);
    expect(list.json.meta.total).toBe(0);
    expect((await call(listMovies, "GET", "/api/v1/movies")).json.data.map((m: { title: string }) => m.title)).toEqual(["ยังอยู่"]);

    expect((await call(getMovie, "GET", `/api/v1/movies/${movie.id}`, id)).status).toBe(404);
    expect((await call(listReviews, "GET", `/api/v1/movies/${movie.id}/reviews`, id)).status).toBe(404);
    expect((await call(postReview, "POST", `/api/v1/movies/${movie.id}/reviews`, id, { cookie: admin.cookie, body: { rating: 5, content: "ลองรีวิว" } })).status).toBe(404);
    expect((await call(addWatch, "POST", "/api/v1/watchlist/me", {}, { cookie: admin.cookie, body: { movie_id: movie.id } })).status).toBe(404);

    const wl = await call(listWatchlist, "GET", "/api/v1/watchlist/me", {}, { cookie: member.cookie });
    expect(wl.json.data.map((m: { title: string }) => m.title)).toEqual(["ยังอยู่"]);

    const { PATCH, DELETE } = await import("@/app/api/v1/reviews/[id]/route");
    const rid = { id: String(review.id) };
    expect((await call(PATCH, "PATCH", `/api/v1/reviews/${review.id}`, rid, { cookie: member.cookie, body: { rating: 1 } })).status).toBe(404);
    expect((await call(DELETE, "DELETE", `/api/v1/reviews/${review.id}`, rid, { cookie: member.cookie })).status).toBe(404);
    expect((await listAllReviews(undefined, 1, 10)).items).toHaveLength(0);

    expect(await prisma.movie.count()).toBe(2);
    expect(await prisma.review.count()).toBe(1);
    expect(await prisma.watchlist.count()).toBe(2);
  });
});

describe("catalog", () => {
  it("searches, filters, sorts by rating/review count, paginates, and rejects bad params", async () => {
    const [a, b] = await Promise.all([
      makeMovie("อะไรสักอย่าง", { genre: "ดราม่า", releaseYear: 2020 }),
      makeMovie("บีมูฟวี่ 100%", { genre: "ตลก,ดราม่า", releaseYear: 2021 }),
      makeMovie("ซีไม่มีรีวิว", { genre: "สยองขวัญ", releaseYear: 2021 }),
    ]);
    const users = await Promise.all([makeUser("u1@x.test"), makeUser("u2@x.test"), makeUser("u3@x.test")]);
    const rate = (u: number, m: number, rating: number) =>
      prisma.review.create({ data: { userId: users[u].id, movieId: m, rating, content: "รีวิวทดสอบ" } });
    await rate(0, a.id, 5);
    await rate(0, b.id, 4);
    await rate(1, b.id, 5);
    await rate(2, b.id, 4);

    const titles = async (query: Record<string, string | number>) =>
      (await call(listMovies, "GET", "/api/v1/movies", {}, { query })).json.data.map((m: { title: string }) => m.title);

    expect(await titles({ sort: "top_rated" })).toEqual(["อะไรสักอย่าง", "บีมูฟวี่ 100%", "ซีไม่มีรีวิว"]);
    expect(await titles({ sort: "most_reviewed" })).toEqual(["บีมูฟวี่ 100%", "อะไรสักอย่าง", "ซีไม่มีรีวิว"]);
    expect(await titles({ genre: "ดราม่า" })).toHaveLength(2);
    expect(await titles({ genre: "ดรา" })).toHaveLength(0);
    expect(await titles({ year: 2021 })).toHaveLength(2);
    expect(await titles({ q: "100%" })).toEqual(["บีมูฟวี่ 100%"]);
    expect(await titles({ q: "%" })).toEqual(["บีมูฟวี่ 100%"]);

    const p2 = await call(listMovies, "GET", "/api/v1/movies", {}, { query: { page_size: 2, page: 2, sort: "top_rated" } });
    expect(p2.json.meta).toEqual({ page: 2, page_size: 2, total: 3, total_pages: 2 });
    expect(p2.json.data).toHaveLength(1);

    const stat = (await call(listMovies, "GET", "/api/v1/movies", {}, { query: { q: "บีมูฟวี่" } })).json.data[0];
    expect(stat.average_rating).toBe(4.33);
    expect(stat.review_count).toBe(3);
    const none = (await call(listMovies, "GET", "/api/v1/movies", {}, { query: { q: "ซีไม่มี" } })).json.data[0];
    expect(none.average_rating).toBeNull();

    expect((await call(listMovies, "GET", "/api/v1/movies", {}, { query: { page_size: 500 } })).status).toBe(400);
    expect((await call(listMovies, "GET", "/api/v1/movies", {}, { query: { sort: "random" } })).status).toBe(400);
    expect((await call(getMovie, "GET", "/api/v1/movies/abc", { id: "abc" })).status).toBe(400);
    expect((await call(getMovie, "GET", "/api/v1/movies/999999", { id: "999999" })).status).toBe(404);
  });
});

describe("TMDB without credentials", () => {
  it("reports missing configuration with 503 instead of faking results", async () => {
    const saved = process.env.TMDB_API_READ_ACCESS_TOKEN;
    delete process.env.TMDB_API_READ_ACCESS_TOKEN;
    try {
      const admin = await makeUser("a@x.test", "admin");
      const s = await call(tmdbSearch, "GET", "/api/v1/admin/tmdb/search", {}, { cookie: admin.cookie, query: { query: "parasite" } });
      expect(s.status).toBe(503);
      expect(s.json.error.code).toBe("tmdb_not_configured");
      const i = await call(tmdbImport, "POST", "/api/v1/admin/tmdb/import", {}, { cookie: admin.cookie, body: { tmdb_id: 496243 } });
      expect(i.status).toBe(503);
      expect(await prisma.movie.count()).toBe(0);
    } finally {
      if (saved !== undefined) process.env.TMDB_API_READ_ACCESS_TOKEN = saved;
    }
  });
});
