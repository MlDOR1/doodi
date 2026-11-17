import { prisma } from "./db";
import { ApiError, isUniqueViolation } from "./http";
import { createMovie, getMovieOr404 } from "./movies";
import { normalizeGenre } from "./schemas";
import type { MovieCreditsDTO, MovieVideoDTO, RecommendedMovieDTO, WatchProvidersDTO } from "@/lib/types";

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";

export const tmdbConfigured = () => !!process.env.TMDB_API_READ_ACCESS_TOKEN?.trim();

async function tmdbFetch<T>(path: string, params: Record<string, string | number>, revalidate = 0): Promise<T> {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new ApiError(
      503,
      "tmdb_not_configured",
      "ยังไม่ได้ตั้งค่า TMDB_API_READ_ACCESS_TOKEN ฝั่งเซิร์ฟเวอร์ จึงยังค้นหาหรือนำเข้าจาก TMDB ไม่ได้",
    );
  }
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      ...(revalidate ? { next: { revalidate } } : { cache: "no-store" }),
    });
  } catch {
    throw new ApiError(502, "tmdb_unreachable", "เชื่อมต่อ TMDB ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
  if (res.status === 401) throw new ApiError(502, "tmdb_auth_failed", "TMDB ปฏิเสธ token ตรวจสอบค่า TMDB_API_READ_ACCESS_TOKEN");
  if (res.status === 404) throw new ApiError(404, "tmdb_not_found", "ไม่พบหนังนี้บน TMDB");
  if (res.status === 429) throw new ApiError(429, "tmdb_rate_limited", "TMDB จำกัดการเรียกใช้ชั่วคราว ลองใหม่ภายหลัง");
  if (!res.ok) throw new ApiError(502, "tmdb_error", `TMDB ตอบกลับผิดพลาด (${res.status})`);
  return (await res.json()) as T;
}

interface TmdbSearchItem {
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  genre_ids?: number[];
}

let genreCache: Map<number, string> | null = null;
async function genreMap() {
  if (genreCache) return genreCache;
  const data = await tmdbFetch<{ genres: { id: number; name: string }[] }>("/genre/movie/list", { language: "th" });
  genreCache = new Map(data.genres.map((g) => [g.id, g.name]));
  return genreCache;
}

const yearOf = (d?: string) => {
  const y = Number(d?.slice(0, 4));
  return Number.isInteger(y) && y > 1800 ? y : null;
};
const posterOf = (p?: string | null) => (p ? `${IMG}${p}` : null);

async function tmdbIdFor(movieId: number) {
  const movie = await getMovieOr404(movieId);
  if (movie.tmdb_id === null) throw new ApiError(404, "tmdb_movie_unavailable", "หนังเรื่องนี้ยังไม่ได้เชื่อมกับ TMDB");
  return movie.tmdb_id;
}

export async function movieCredits(movieId: number): Promise<MovieCreditsDTO> {
  const tmdbId = await tmdbIdFor(movieId);
  const data = await tmdbFetch<{
    cast: { id: number; name: string; character?: string; profile_path?: string | null }[];
    crew: { id: number; name: string; job: string }[];
  }>(`/movie/${tmdbId}/credits`, { language: "th-TH" }, 3600);
  return {
    cast: data.cast.slice(0, 12).map((person) => ({
      person_id: person.id, name: person.name, character: person.character ?? "",
      profile_url: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
    })),
    directors: data.crew.filter((person) => person.job === "Director").map((person) => ({ person_id: person.id, name: person.name })),
  };
}

interface TmdbVideo {
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
  iso_639_1?: string;
}

export async function movieVideos(movieId: number): Promise<MovieVideoDTO[]> {
  const tmdbId = await tmdbIdFor(movieId);
  const usable = (videos: TmdbVideo[]) => videos.filter((video) =>
    video.site === "YouTube" && /^[\w-]{11}$/.test(video.key) && ["Trailer", "Teaser"].includes(video.type),
  );
  const th = await tmdbFetch<{ results: TmdbVideo[] }>(`/movie/${tmdbId}/videos`, { language: "th-TH" }, 3600);
  let videos = usable(th.results);
  if (!videos.length) {
    const en = await tmdbFetch<{ results: TmdbVideo[] }>(`/movie/${tmdbId}/videos`, { language: "en-US" }, 3600);
    videos = usable(en.results);
  }
  const priority = (video: TmdbVideo) =>
    Number(/trailer|ตัวอย่าง/i.test(video.name)) * 4 + Number(video.type === "Trailer") * 2 + Number(video.official ?? false);
  return videos.sort((a, b) => priority(b) - priority(a)).slice(0, 3).map((video) => ({
    name: video.name, type: video.type, language: video.iso_639_1 ?? "", official: video.official ?? false,
    url: `https://www.youtube.com/watch?v=${video.key}`,
    embed_url: `https://www.youtube-nocookie.com/embed/${video.key}`,
  }));
}

export async function movieRecommendations(movieId: number): Promise<RecommendedMovieDTO[]> {
  const tmdbId = await tmdbIdFor(movieId);
  const data = await tmdbFetch<{ results: (TmdbSearchItem & { adult?: boolean })[] }>(
    `/movie/${tmdbId}/recommendations`, { language: "th-TH", page: 1 }, 3600,
  );
  const items = data.results.filter((movie) => !movie.adult && movie.id !== tmdbId).slice(0, 8);
  const existing = await prisma.movie.findMany({
    where: { tmdbId: { in: items.map((movie) => movie.id) } }, select: { id: true, tmdbId: true, deletedAt: true },
  });
  const known = new Map(existing.map((movie) => [movie.tmdbId, movie]));
  return items.filter((movie) => !known.get(movie.id)?.deletedAt).map((movie) => ({
    tmdb_id: movie.id, movie_id: known.get(movie.id)?.id ?? null, title: movie.title,
    release_year: yearOf(movie.release_date), poster_url: posterOf(movie.poster_path),
    url: `https://www.themoviedb.org/movie/${movie.id}`,
  }));
}

export async function movieWatchProviders(movieId: number): Promise<WatchProvidersDTO> {
  const tmdbId = await tmdbIdFor(movieId);
  type Provider = { provider_id: number; provider_name: string; logo_path?: string | null };
  const data = await tmdbFetch<{ results: Record<string, { link?: string } & Partial<Record<"flatrate" | "rent" | "buy" | "free" | "ads", Provider[]>>> }>(
    `/movie/${tmdbId}/watch/providers`, {}, 3600,
  );
  const region = data.results.TH;
  const labels = { flatrate: "สตรีมแบบสมาชิก", rent: "เช่า", buy: "ซื้อ", free: "ดูฟรี", ads: "ดูพร้อมโฆษณา" } as const;
  return {
    country: "TH", attribution: "JustWatch",
    link: region?.link?.startsWith("https://www.themoviedb.org/") ? region.link : null,
    groups: (Object.keys(labels) as (keyof typeof labels)[]).flatMap((type) => {
      const providers = region?.[type] ?? [];
      return providers.length ? [{
        type, label: labels[type], providers: providers.map((provider) => ({
          provider_id: provider.provider_id, name: provider.provider_name,
          logo_url: provider.logo_path ? `https://image.tmdb.org/t/p/w92${provider.logo_path}` : null,
        })),
      }] : [];
    }),
  };
}

export async function searchTmdb(query: string, page: number) {
  const [data, genres] = await Promise.all([
    tmdbFetch<{ results: TmdbSearchItem[]; total_pages: number; total_results: number; page: number }>("/search/movie", {
      query,
      page,
      language: "th-TH",
      include_adult: "false",
    }),
    genreMap(),
  ]);
  const ids = data.results.map((r) => r.id);
  const existing = await prisma.movie.findMany({ where: { tmdbId: { in: ids } }, select: { tmdbId: true } });
  const imported = new Set(existing.map((e) => e.tmdbId));
  return {
    items: data.results.map((r) => ({
      tmdb_id: r.id,
      title: r.title,
      original_title: r.original_title ?? null,
      overview: r.overview || null,
      release_year: yearOf(r.release_date),
      poster_url: posterOf(r.poster_path),
      genre: normalizeGenre((r.genre_ids ?? []).map((id) => genres.get(id)).filter(Boolean).join(",")) || null,
      already_imported: imported.has(r.id),
    })),
    meta: { page: data.page, total: data.total_results, total_pages: Math.min(data.total_pages, 500) },
  };
}

// Now-playing (this month's theatrical roster) + popular, skipping anything already in the DB, deleted ones included.
export async function importCurrent(limit = 20) {
  const lists = await Promise.all(
    ["/movie/now_playing", "/movie/popular"].map((p) =>
      tmdbFetch<{ results: TmdbSearchItem[] }>(p, { language: "th-TH", region: "TH", page: 1 }),
    ),
  );
  const ids = [...new Set(lists.flatMap((l) => l.results).filter((r) => r.poster_path).map((r) => r.id))];
  const known = new Set((await prisma.movie.findMany({ where: { tmdbId: { in: ids } }, select: { tmdbId: true } })).map((m) => m.tmdbId));
  const todo = ids.filter((id) => !known.has(id)).slice(0, limit);
  const imported: number[] = [];
  const failed: number[] = [];
  for (const id of todo) {
    try {
      await importTmdb(id);
      imported.push(id);
    } catch {
      failed.push(id);
    }
  }
  return { candidates: ids.length, imported, failed };
}

// Titles in every language TMDB has (zh, ja, ko, es, fr, de, ru, ar, hi...) plus original and English, so search works in any of them.
export async function altTitlesOf(tmdbId: number, primary: string, original?: string): Promise<string | null> {
  const [tr, en] = await Promise.all([
    tmdbFetch<{ translations: { data: { title?: string } }[] }>(`/movie/${tmdbId}/translations`, {}),
    tmdbFetch<TmdbDetail>(`/movie/${tmdbId}`, { language: "en-US" }),
  ]);
  const all = [original, en.title, ...tr.translations.map((t) => t.data.title)]
    .map((t) => t?.trim())
    .filter((t): t is string => !!t && t !== primary);
  return [...new Set(all)].join("\n").slice(0, 8000) || null;
}

interface TmdbDetail extends TmdbSearchItem {
  genres?: { id: number; name: string }[];
}

export async function importTmdb(tmdbId: number) {
  const dup = await prisma.movie.findUnique({ where: { tmdbId }, select: { deletedAt: true } });
  if (dup) {
    throw new ApiError(
      409,
      "tmdb_already_imported",
      dup.deletedAt ? "หนังเรื่องนี้เคยถูกนำเข้าและถูกลบไปแล้ว" : "หนังเรื่องนี้ถูกนำเข้าแล้ว",
    );
  }
  const th = await tmdbFetch<TmdbDetail>(`/movie/${tmdbId}`, { language: "th-TH" });
  let title: string | undefined = th.title?.trim();
  let overview: string | undefined = th.overview?.trim();
  if (!title || !overview) {
    const en = await tmdbFetch<TmdbDetail>(`/movie/${tmdbId}`, { language: "en-US" });
    title = title || en.title?.trim() || th.original_title?.trim();
    overview = overview || en.overview?.trim();
  }
  if (!title) throw new ApiError(502, "tmdb_error", "ข้อมูลจาก TMDB ไม่สมบูรณ์ (ไม่มีชื่อหนัง)");
  try {
    return await createMovie({
      tmdb_id: tmdbId,
      title: title.slice(0, 255),
      synopsis: overview || null,
      genre: normalizeGenre((th.genres ?? []).map((g) => g.name).join(",")).slice(0, 100) || null,
      release_year: yearOf(th.release_date),
      poster_url: posterOf(th.poster_path),
      alt_titles: await altTitlesOf(tmdbId, title, th.original_title).catch(() => null),
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "tmdb_already_imported", "หนังเรื่องนี้ถูกนำเข้าแล้ว");
    throw e;
  }
}
