import Link from "next/link";
import { z } from "zod";
import { listAllReviews } from "@/server/reviews";
import { pageQuery } from "@/server/schemas";
import { Pagination } from "@/components/Pagination";
import { ReviewItem } from "@/components/ReviewItem";
import { btnGhost, btnPrimary, input } from "@/components/ui";

const query = pageQuery(10).extend({ q: z.string().trim().max(100).optional() });

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const raw = await searchParams;
  const parsed = query.safeParse({ q: raw.q || undefined, page: raw.page });
  const { q, page } = parsed.success ? parsed.data : { q: undefined, page: 1 };
  const { items, meta } = await listAllReviews(q, page, 10);

  return (
    <section aria-labelledby="rev-h">
      <h2 id="rev-h" className="text-2xl font-bold">
        ดูแลรีวิว <span className="text-muted">({meta.total.toLocaleString("th-TH")})</span>
      </h2>
      <p className="mt-1 text-sm text-muted">แก้ไขหรือลบรีวิวที่ไม่เหมาะสม ผลกับคะแนนเฉลี่ยจะคำนวณใหม่ทันที</p>

      <form action="/admin/reviews" role="search" className="mt-5 flex flex-wrap gap-2">
        <label htmlFor="rev-q" className="sr-only">
          ค้นหาตามชื่อหนัง
        </label>
        <input id="rev-q" name="q" type="search" defaultValue={q} placeholder="ค้นหาตามชื่อหนัง" maxLength={100} className={`${input} max-w-sm`} />
        <button type="submit" className={btnPrimary}>
          ค้นหา
        </button>
        {q && (
          <Link href="/admin/reviews" className={btnGhost}>
            ล้าง
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-muted">ไม่พบรีวิว</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {items.map((r) => (
            <li key={r.reviews_id}>
              <p className="mb-2 text-sm text-muted">
                รีวิวหนัง{" "}
                <Link href={`/movies/${r.movie_id}`} className="font-semibold text-cream hover:text-flare">
                  {r.movie_title}
                </Link>
              </p>
              <ul>
                <ReviewItem review={r} canManage isMine={false} />
              </ul>
            </li>
          ))}
        </ul>
      )}
      <Pagination basePath="/admin/reviews" params={{ q }} page={meta.page} totalPages={meta.total_pages} />
    </section>
  );
}
