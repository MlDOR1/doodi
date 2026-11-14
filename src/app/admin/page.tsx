import Link from "next/link";
import { listMovies } from "@/server/movies";
import { movieListQuery } from "@/server/schemas";
import { AddMovieButton, MovieRowActions } from "@/components/MovieAdmin";
import { Pagination } from "@/components/Pagination";
import { Poster } from "@/components/Poster";
import { btnGhost, btnPrimary, input } from "@/components/ui";

export default async function AdminMoviesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const raw = await searchParams;
  const parsed = movieListQuery.pick({ q: true, page: true }).safeParse({ q: raw.q || undefined, page: raw.page });
  const { q, page } = parsed.success ? parsed.data : { q: undefined, page: 1 };
  const { items, meta } = await listMovies({ q, page, page_size: 10, sort: "newest" });

  return (
    <section aria-labelledby="movies-h">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="movies-h" className="text-2xl font-bold">
          หนังในระบบ <span className="text-muted">({meta.total.toLocaleString("th-TH")})</span>
        </h2>
        <AddMovieButton />
      </div>

      <form action="/admin" role="search" className="mt-5 flex flex-wrap gap-2">
        <label htmlFor="admin-q" className="sr-only">
          ค้นหาชื่อหนัง
        </label>
        <input id="admin-q" name="q" type="search" defaultValue={q} placeholder="ค้นหาชื่อหนัง" maxLength={100} className={`${input} max-w-sm`} />
        <button type="submit" className={btnPrimary}>
          ค้นหา
        </button>
        {q && (
          <Link href="/admin" className={btnGhost}>
            ล้าง
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-muted">
          {q ? "ไม่พบหนังที่ตรงกับคำค้นหา" : "ยังไม่มีหนังในระบบ"}
        </p>
      ) : (
        <div className="relative mt-6 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">รายการหนังทั้งหมด</caption>
            <thead className="bg-raised text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">หนัง</th>
                <th scope="col" className="px-4 py-3">ปี</th>
                <th scope="col" className="px-4 py-3">ประเภท</th>
                <th scope="col" className="px-4 py-3 text-right">รีวิว</th>
                <th scope="col" className="px-4 py-3 text-right">TMDB</th>
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">จัดการ</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {items.map((m) => (
                <tr key={m.movie_id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 shrink-0 overflow-hidden rounded">
                        <Poster src={m.poster_url} title={m.title} />
                      </div>
                      <Link href={`/movies/${m.movie_id}`} className="font-semibold hover:text-flare">
                        {m.title}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{m.release_year ?? "–"}</td>
                  <td className="px-4 py-3 text-muted">{m.genre?.split(",").join(", ") ?? "–"}</td>
                  <td className="px-4 py-3 text-right text-muted">{m.review_count}</td>
                  <td className="px-4 py-3 text-right text-muted">{m.tmdb_id ?? "–"}</td>
                  <td className="px-4 py-3">
                    <MovieRowActions movie={m} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination basePath="/admin" params={{ q }} page={meta.page} totalPages={meta.total_pages} />
    </section>
  );
}
