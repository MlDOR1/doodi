import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as tmdbSearch } from "@/app/api/v1/admin/tmdb/search/route";
import { POST as tmdbImport } from "@/app/api/v1/admin/tmdb/import/route";
import { GET as credits } from "@/app/api/v1/movies/[id]/credits/route";
import { GET as videos } from "@/app/api/v1/movies/[id]/videos/route";
import { GET as recommendations } from "@/app/api/v1/movies/[id]/recommendations/route";
import { GET as providers } from "@/app/api/v1/movies/[id]/watch-providers/route";
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
  it("shows public cast and directors for an imported movie without exposing credentials", async () => {
    const movie = await makeMovie("Imported", { tmdbId: 42 });
    stubTmdb(() => ({
      cast: [{ id: 1, name: "Actor", character: "Hero", profile_path: "/actor.jpg" }],
      crew: [{ id: 2, name: "Director", job: "Director" }, { id: 3, name: "Editor", job: "Editor" }],
    }));
    const res = await call(credits, "GET", `/api/v1/movies/${movie.id}/credits`, { id: String(movie.id) });
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({
      cast: [{ person_id: 1, character: "Hero", profile_url: "https://image.tmdb.org/t/p/w185/actor.jpg" }],
      directors: [{ person_id: 2, name: "Director" }],
    });
    expect(res.text).not.toContain(TOKEN);
    expect(calls[0].url.pathname).toBe("/3/movie/42/credits");
    expect(calls[0].auth).toBe(`Bearer ${TOKEN}`);
  });

  it("falls back to English trailers and only returns safe YouTube video keys", async () => {
    const movie = await makeMovie("Imported", { tmdbId: 42 });
    stubTmdb((url) => ({ results: url.searchParams.get("language") === "th-TH" ? [
      { site: "YouTube", key: "../bad?url=x", name: "Bad", type: "Trailer" },
    ] : [
      { site: "Vimeo", key: "abcdefghijk", name: "Other", type: "Trailer" },
      { site: "YouTube", key: "abcdefghijk", name: "Official", type: "Trailer", official: true, iso_639_1: "en" },
      { site: "YouTube", key: "lmnopqrstuv", name: "Clip", type: "Clip" },
    ] }));
    const res = await call(videos, "GET", `/api/v1/movies/${movie.id}/videos`, { id: String(movie.id) });
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([{
      name: "Official", type: "Trailer", language: "en", official: true,
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      embed_url: "https://www.youtube-nocookie.com/embed/abcdefghijk",
    }]);
    expect(calls.map((c) => c.url.searchParams.get("language"))).toEqual(["th-TH", "en-US"]);
  });

  it("prioritizes a trailer over TV spots returned with the same TMDB video type", async () => {
    const movie = await makeMovie("Imported", { tmdbId: 42 });
    stubTmdb(() => ({ results: [
      { site: "YouTube", key: "abcdefghijk", name: "TV Spot", type: "Trailer", official: true },
      { site: "YouTube", key: "lmnopqrstuv", name: "Official Trailer", type: "Trailer", official: true },
    ] }));
    const res = await call(videos, "GET", `/api/v1/movies/${movie.id}/videos`, { id: String(movie.id) });
    expect(res.json.data[0].name).toBe("Official Trailer");
  });

  it("links recommended movies locally when imported, excludes deleted/adult movies, and never imports on GET", async () => {
    const movie = await makeMovie("Imported", { tmdbId: 42 });
    const local = await makeMovie("Known", { tmdbId: 7 });
    await makeMovie("Deleted", { tmdbId: 8, deletedAt: new Date() });
    stubTmdb(() => ({ results: [
      { id: 7, title: "Known", release_date: "2026-01-01", poster_path: "/a.jpg" },
      { id: 8, title: "Deleted" }, { id: 9, title: "External" }, { id: 10, title: "Adult", adult: true },
    ] }));
    const res = await call(recommendations, "GET", `/api/v1/movies/${movie.id}/recommendations`, { id: String(movie.id) });
    expect(res.status).toBe(200);
    expect(res.json.data.map((m: { tmdb_id: number }) => m.tmdb_id)).toEqual([7, 9]);
    expect(res.json.data[0]).toMatchObject({ movie_id: local.id, release_year: 2026 });
    expect(res.json.data[1]).toMatchObject({ movie_id: null, url: "https://www.themoviedb.org/movie/9" });
    expect(await prisma.movie.count()).toBe(3);
  });

  it("returns Thailand availability with JustWatch attribution and never substitutes another country", async () => {
    const movie = await makeMovie("Imported", { tmdbId: 42 });
    stubTmdb(() => ({ results: {
      TH: { link: "https://www.themoviedb.org/movie/42/watch?locale=TH", flatrate: [{ provider_id: 1, provider_name: "Thai service", logo_path: "/logo.jpg" }] },
      US: { buy: [{ provider_id: 2, provider_name: "US only" }] },
    } }));
    const path = `/api/v1/movies/${movie.id}/watch-providers`;
    const res = await call(providers, "GET", path, { id: String(movie.id) });
    expect(res.json.data).toMatchObject({ country: "TH", attribution: "JustWatch", groups: [{ type: "flatrate", providers: [{ name: "Thai service" }] }] });
    expect(res.text).not.toContain("US only");
    stubTmdb(() => ({ results: { US: { link: "https://www.themoviedb.org/movie/42", buy: [] } } }));
    expect((await call(providers, "GET", path, { id: String(movie.id) })).json.data).toMatchObject({ country: "TH", link: null, groups: [] });
    stubTmdb(() => ({ results: { TH: { link: "javascript:alert(1)" } } }));
    expect((await call(providers, "GET", path, { id: String(movie.id) })).json.data.link).toBeNull();
  });

  it("rejects unavailable local movies before contacting TMDB and propagates missing configuration", async () => {
    const manual = await makeMovie("Manual");
    const deleted = await makeMovie("Deleted", { tmdbId: 42, deletedAt: new Date() });
    stubTmdb(() => null);
    for (const handler of [credits, videos, recommendations, providers]) {
      for (const id of [manual.id, deleted.id, 2147483647]) {
        expect((await call(handler, "GET", `/api/v1/movies/${id}/extra`, { id: String(id) })).status).toBe(404);
      }
    }
    expect(calls).toHaveLength(0);
    const imported = await makeMovie("Imported", { tmdbId: 43 });
    delete process.env.TMDB_API_READ_ACCESS_TOKEN;
    const res = await call(credits, "GET", `/api/v1/movies/${imported.id}/credits`, { id: String(imported.id) });
    expect(res.status).toBe(503);
  });

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
