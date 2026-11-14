import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as tmdbSearch } from "@/app/api/v1/admin/tmdb/search/route";
import { POST as tmdbImport } from "@/app/api/v1/admin/tmdb/import/route";
import { prisma } from "@/server/db";
import { call, makeMovie, makeUser, resetDb } from "./helpers";

// These use a stubbed TMDB: they verify OUR mapping, auth header and duplicate handling,
// not that TMDB itself is reachable. Real-credential verification is a manual step (see README).
const TOKEN = "test-token";
const calls: { url: URL; auth: string | null }[] = [];

function stubTmdb(handler: (url: URL) => unknown | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({ url, auth: new Headers(init?.headers).get("authorization") });
      const body = handler(url);
      return body === null ? new Response("{}", { status: 404 }) : Response.json(body);
    }),
  );
}

beforeEach(async () => {
  await resetDb();
  calls.length = 0;
  process.env.TMDB_API_READ_ACCESS_TOKEN = TOKEN;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TMDB_API_READ_ACCESS_TOKEN;
});

describe("TMDB (stubbed)", () => {
  it("imports mapped Thai metadata once, falls back to English, and rejects duplicates with 409", async () => {
    const admin = await makeUser("a@x.test", "admin");
    stubTmdb((u) => {
      if (u.pathname !== "/3/movie/42") return null;
      return u.searchParams.get("language") === "th-TH"
        ? { id: 42, title: "ชื่อไทย", overview: "", release_date: "2021-05-06", poster_path: "/p.jpg", genres: [{ id: 1, name: "ดราม่า" }, { id: 2, name: "ตลก" }] }
        : { id: 42, title: "English Title", overview: "English overview" };
    });

    const res = await call(tmdbImport, "POST", "/api/v1/admin/tmdb/import", {}, { cookie: admin.cookie, body: { tmdb_id: 42 } });
    expect(res.status).toBe(201);
    expect(res.json.data).toMatchObject({
      tmdb_id: 42,
      title: "ชื่อไทย",
      synopsis: "English overview",
      genre: "ดราม่า,ตลก",
      release_year: 2021,
      poster_url: "https://image.tmdb.org/t/p/w500/p.jpg",
    });
    expect(calls.every((c) => c.auth === `Bearer ${TOKEN}`)).toBe(true);

    const again = await call(tmdbImport, "POST", "/api/v1/admin/tmdb/import", {}, { cookie: admin.cookie, body: { tmdb_id: 42 } });
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe("tmdb_already_imported");
    expect(await prisma.movie.count({ where: { tmdbId: 42 } })).toBe(1);
  });

  it("still blocks re-importing a soft-deleted TMDB movie instead of crashing on the unique index", async () => {
    const admin = await makeUser("a@x.test", "admin");
    await makeMovie("เคยนำเข้า", { tmdbId: 7, deletedAt: new Date() });
    stubTmdb(() => null);
    const res = await call(tmdbImport, "POST", "/api/v1/admin/tmdb/import", {}, { cookie: admin.cookie, body: { tmdb_id: 7 } });
    expect(res.status).toBe(409);
    expect(calls).toHaveLength(0);
  });

  it("search maps results, flags already-imported movies, and never leaks the token", async () => {
    const admin = await makeUser("a@x.test", "admin");
    await makeMovie("มีแล้ว", { tmdbId: 1 });
    stubTmdb((u) =>
      u.pathname === "/3/genre/movie/list"
        ? { genres: [{ id: 18, name: "ดราม่า" }] }
        : {
            page: 1,
            total_pages: 1,
            total_results: 2,
            results: [
              { id: 1, title: "มีแล้ว", release_date: "2020-01-01", poster_path: null, genre_ids: [18] },
              { id: 2, title: "ใหม่", original_title: "New", overview: "x", release_date: "", poster_path: "/n.jpg", genre_ids: [] },
            ],
          },
    );
    const res = await call(tmdbSearch, "GET", "/api/v1/admin/tmdb/search", {}, { cookie: admin.cookie, query: { query: "a" } });
    expect(res.status).toBe(200);
    expect(res.json.data.map((r: { already_imported: boolean }) => r.already_imported)).toEqual([true, false]);
    expect(res.json.data[0]).toMatchObject({ genre: "ดราม่า", release_year: 2020, poster_url: null });
    expect(res.json.data[1]).toMatchObject({ release_year: null, poster_url: "https://image.tmdb.org/t/p/w500/n.jpg" });
    expect(res.text).not.toContain(TOKEN);
    expect((await call(tmdbSearch, "GET", "/api/v1/admin/tmdb/search", {}, { cookie: admin.cookie })).status).toBe(400);
  });

  it("maps a rejected token to a clear 502 rather than a fake success", async () => {
    const admin = await makeUser("a@x.test", "admin");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const res = await call(tmdbImport, "POST", "/api/v1/admin/tmdb/import", {}, { cookie: admin.cookie, body: { tmdb_id: 5 } });
    expect(res.status).toBe(502);
    expect(res.json.error.code).toBe("tmdb_auth_failed");
    expect(await prisma.movie.count()).toBe(0);
  });
});
