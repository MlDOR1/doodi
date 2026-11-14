import Link from "next/link";
import type { Metadata } from "next";
import { filterOptions, listMovies } from "@/server/movies";
import { movieListQuery } from "@/server/schemas";
import { MovieCard, MovieGrid } from "@/components/MovieCard";
import { Pagination } from "@/components/Pagination";
import { btnGhost, btnPrimary, input, label } from "@/components/ui";

export const metadata: Metadata = { title: "หนังทั้งหมด" };
export const dynamic = "force-dynamic";

const SORT_LABELS = { newest: "ใหม่ล่าสุด", top_rated: "คะแนนสูงสุด", most_reviewed: "รีวิวมากที่สุด" } as const;

export default async function MoviesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) flat[k] = s;
  }
  // Bad user-typed URL params fall back to defaults instead of crashing the page.
  const parsed = movieListQuery.safeParse(flat);
  const query = parsed.success ? parsed.data : movieListQuery.parse({});

  const [{ items, meta }, options] = await Promise.all([listMovies(query), filterOptions()]);
  const hasFilters = !!(query.q || query.genre || query.year);
  const urlParams = {
    q: query.q,
    genre: query.genre,
    year: query.year?.toString(),
    sort: query.sort === "newest" ? undefined : query.sort,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold sm:text-4xl">หนังทั้งหมด</h1>
      <p className="mt-1 text-muted">ค้นหา กรอง และเรียงตามคะแนนจากสมาชิก DOODI</p>

      <form action="/movies" role="search" className="mt-8 grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="q" className={label}>
            ชื่อหนัง
          </label>
          <input id="q" name="q" type="search" defaultValue={query.q} placeholder="เช่น หลานม่า" maxLength={100} className={input} />
        </div>
        <div>
          <label htmlFor="genre" className={label}>
            ประเภท
          </label>
          <select id="genre" name="genre" defaultValue={query.genre ?? ""} className={input}>
            <option value="">ทุกประเภท</option>
            {options.genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="year" className={label}>
            ปีที่ออกฉาย
          </label>
          <select id="year" name="year" defaultValue={query.year?.toString() ?? ""} className={input}>
            <option value="">ทุกปี</option>
            {options.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sort" className={label}>
            เรียงตาม
          </label>
          <select id="sort" name="sort" defaultValue={query.sort} className={input}>
            {Object.entries(SORT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className={btnPrimary}>
            ค้นหา
          </button>
          {hasFilters && (
            <Link href="/movies" className={btnGhost}>
              ล้าง
            </Link>
          )}
        </div>
      </form>

      <p className="mt-8 text-sm text-muted" role="status">
        พบ {meta.total.toLocaleString("th-TH")} เรื่อง
        {query.q && <> สำหรับ “{query.q}”</>}
      </p>

      <div className="mt-6">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <p className="text-xl font-bold">ไม่พบหนังที่ตรงกับเงื่อนไข</p>
            <p className="mt-2 text-muted">ลองเปลี่ยนคำค้นหา หรือล้างตัวกรองเพื่อดูหนังทั้งหมด</p>
            {hasFilters && (
              <Link href="/movies" className={`${btnPrimary} mt-6`}>
                ล้างตัวกรอง
              </Link>
            )}
          </div>
        ) : (
          <MovieGrid>
            {items.map((m) => (
              <MovieCard key={m.movie_id} movie={m} />
            ))}
          </MovieGrid>
        )}
      </div>

      <Pagination basePath="/movies" params={urlParams} page={meta.page} totalPages={meta.total_pages} />
    </div>
  );
}
