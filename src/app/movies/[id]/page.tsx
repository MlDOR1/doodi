import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMovie } from "@/server/movies";
import { getMyReview, listReviews } from "@/server/reviews";
import { isInWatchlist } from "@/server/watchlist";
import { getCurrentUser } from "@/server/current-user";
import { formatRating, genreList } from "@/lib/format";
import { pageQuery } from "@/server/schemas";
import { Pagination } from "@/components/Pagination";
import { Poster } from "@/components/Poster";
import { Star } from "@/components/Rating";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewItem } from "@/components/ReviewItem";
import { WatchlistButton } from "@/components/WatchlistButton";
import { btnPrimary, panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const parseId = (s: string) => (/^\d{1,10}$/.test(s) && Number(s) <= 2147483647 && Number(s) > 0 ? Number(s) : null);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = parseId((await params).id);
  const movie = id ? await getMovie(id) : null;
  return { title: movie?.title ?? "ไม่พบหนัง" };
}

export default async function MovieDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const movie = await getMovie(id);
  if (!movie) notFound();

  const sp = pageQuery(10).safeParse({ page: (await searchParams).page });
  const pageNo = sp.success ? sp.data.page : 1;

  const user = await getCurrentUser();
  const [reviews, mine, saved] = await Promise.all([
    listReviews(id, pageNo, 10),
    user ? getMyReview(user.user_id, id) : null,
    user ? isInWatchlist(user.user_id, id) : false,
  ]);
  const here = `/movies/${id}`;
  const loginHref = `/login?next=${encodeURIComponent(here)}`;
  const genres = genreList(movie.genre);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="เส้นทาง" className="mb-6 text-sm text-muted">
        <Link href="/movies" className="hover:text-flare">
          หนังทั้งหมด
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-cream">{movie.title}</span>
      </nav>

      <section className="grid gap-8 md:grid-cols-[minmax(0,280px)_1fr] lg:gap-12">
        <div className="mx-auto w-full max-w-[280px] md:mx-0">
          <div className="overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/60">
            <Poster src={movie.poster_url} title={movie.title} />
          </div>
        </div>

        <div className="min-w-0">
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">{movie.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-muted">
            <span>{movie.release_year ?? "ไม่ระบุปีที่ออกฉาย"}</span>
            {genres.map((g) => (
              <Link
                key={g}
                href={`/movies?genre=${encodeURIComponent(g)}`}
                className="rounded-full border border-line bg-raised px-3 py-0.5 text-sm text-cream hover:border-flare"
              >
                {g}
              </Link>
            ))}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-line bg-surface p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">คะแนนจากสมาชิก DOODI</p>
              {movie.average_rating === null ? (
                <p className="mt-1 text-xl font-bold">{formatRating(null)}</p>
              ) : (
                <p className="mt-1 flex items-center gap-2">
                  <Star filled className="h-7 w-7" />
                  <span className="text-4xl font-bold">{formatRating(movie.average_rating)}</span>
                  <span className="text-muted">/ 5</span>
                </p>
              )}
              <p className="mt-1 text-sm text-muted">
                จาก {movie.review_count.toLocaleString("th-TH")} รีวิว
              </p>
            </div>
            <div className="sm:ml-auto">
              <WatchlistButton movieId={id} initialSaved={saved} signedIn={!!user} loginHref={loginHref} />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            คะแนนนี้มาจากรีวิวของสมาชิกบนเว็บไซต์ DOODI เท่านั้น ไม่ใช่คะแนนจาก TMDB หรือผู้ให้บริการภายนอก
          </p>

          <h2 className="mt-8 text-xl font-bold">เรื่องย่อ</h2>
          <p className="mt-2 max-w-prose whitespace-pre-line leading-relaxed text-cream/90">
            {movie.synopsis || "ยังไม่มีเรื่องย่อสำหรับหนังเรื่องนี้"}
          </p>
        </div>
      </section>

      <section id="reviews" aria-labelledby="reviews-h" className="mt-16 grid gap-10 lg:grid-cols-[1fr_minmax(0,380px)] lg:items-start">
        <div className="min-w-0">
          <h2 id="reviews-h" className="text-2xl font-bold sm:text-3xl">
            รีวิวจากคนดู <span className="text-muted">({reviews.meta.total.toLocaleString("th-TH")})</span>
          </h2>
          {reviews.items.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
              <p className="text-lg font-bold">ยังไม่มีรีวิวสำหรับเรื่องนี้</p>
              <p className="mt-1 text-muted">มาเป็นคนแรกที่แบ่งปันความเห็นกันเถอะ</p>
            </div>
          ) : (
            <ul className="mt-6 space-y-4">
              {reviews.items.map((r) => (
                <ReviewItem
                  key={r.reviews_id}
                  review={r}
                  isMine={r.author.user_id === user?.user_id}
                  canManage={!!user && (user.role === "admin" || r.author.user_id === user.user_id)}
                />
              ))}
            </ul>
          )}
          <Pagination basePath={here} params={{}} page={reviews.meta.page} totalPages={reviews.meta.total_pages} hash="reviews" />
        </div>

        <aside className={`${panel} lg:sticky lg:top-24`} aria-labelledby="write-h">
          <h2 id="write-h" className="text-xl font-bold">
            {mine ? "คุณรีวิวเรื่องนี้แล้ว" : "เขียนรีวิว"}
          </h2>
          {!user ? (
            <>
              <p className="mt-2 text-muted">เข้าสู่ระบบเพื่อให้คะแนนและเขียนรีวิวหนังเรื่องนี้</p>
              <Link href={loginHref} className={`${btnPrimary} mt-5`}>
                เข้าสู่ระบบเพื่อรีวิว
              </Link>
            </>
          ) : mine ? (
            <p className="mt-2 text-muted">
              แต่ละคนรีวิวได้เรื่องละหนึ่งครั้ง ใช้ปุ่ม “แก้ไข” ที่รีวิวของคุณในรายการเพื่อปรับปรุงหรือลบ
            </p>
          ) : (
            <div className="mt-4">
              <ReviewForm movieId={id} />
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
