import Link from "next/link";
import type { Metadata } from "next";
import { requireUserPage } from "@/server/current-user";
import { listWatchlist } from "@/server/watchlist";
import { pageQuery } from "@/server/schemas";
import { MovieCard, MovieGrid } from "@/components/MovieCard";
import { Pagination } from "@/components/Pagination";
import { WatchlistButton } from "@/components/WatchlistButton";
import { btnPrimary } from "@/components/ui";

export const metadata: Metadata = { title: "รายการอยากดู" };
export const dynamic = "force-dynamic";

export default async function WatchlistPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUserPage("/watchlist");
  const parsed = pageQuery(12).safeParse({ page: (await searchParams).page });
  const pageNo = parsed.success ? parsed.data.page : 1;
  let { items, meta } = await listWatchlist(user.user_id, pageNo, 12);
  // last item of a later page was removed: land on the new last page instead of an empty one
  if (items.length === 0 && meta.total > 0 && pageNo > 1) {
    ({ items, meta } = await listWatchlist(user.user_id, meta.total_pages, 12));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold sm:text-4xl">รายการอยากดู</h1>
      <p className="mt-1 text-muted">หนังที่คุณบันทึกไว้ดูทีหลัง ({meta.total.toLocaleString("th-TH")} เรื่อง)</p>

      {items.length === 0 ? (
        <div className="curtain mt-10 overflow-hidden rounded-3xl border border-line">
          <div className="bg-gradient-to-b from-ink/70 to-ink/95 px-6 py-20 text-center">
            <svg viewBox="0 0 24 24" className="mx-auto h-14 w-14 text-flare" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" />
            </svg>
            <h2 className="mt-5 text-2xl font-bold">ยังไม่มีหนังในรายการ</h2>
            <p className="mx-auto mt-2 max-w-md text-cream/90">
              เจอหนังที่น่าสนใจ กด “เพิ่มในรายการอยากดู” แล้วมันจะรออยู่ที่นี่
            </p>
            <Link href="/movies" className={`${btnPrimary} mt-8`}>
              เลือกดูหนัง
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <MovieGrid>
            {items.map((m) => (
              <MovieCard
                key={m.movie_id}
                movie={m}
                actions={<WatchlistButton movieId={m.movie_id} initialSaved signedIn loginHref="/login" compact />}
              />
            ))}
          </MovieGrid>
          <Pagination basePath="/watchlist" params={{}} page={meta.page} totalPages={meta.total_pages} />
        </div>
      )}
    </div>
  );
}
