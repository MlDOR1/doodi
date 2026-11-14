import Link from "next/link";
import { featuredMovies, listMovies } from "@/server/movies";
import { Brand } from "@/components/Brand";
import { MovieCard, MovieGrid } from "@/components/MovieCard";
import { btnGhost, btnPrimary } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, latest] = await Promise.all([
    featuredMovies(5),
    listMovies({ sort: "newest", page: 1, page_size: 10 }),
  ]);

  return (
    <>
      <section className="curtain relative isolate overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/80 to-ink" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:py-36">
          <h1 className="sr-only">DOODI Movie Review</h1>
          <Brand size="xl" />
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-cream sm:text-xl">
            ไม่รู้จะดูหนังอะไรดี? อ่านรีวิวจากคนดูจริง เปรียบเทียบคะแนน แล้วเลือกเรื่องที่คุ้มค่าเวลาของคุณ
            ไม่ต้องเสียเวลากับหนังที่โปสเตอร์สวยแต่เนื้อหาพัง
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/movies" className={`${btnPrimary} px-7 text-base`}>
              เลือกดูหนัง
            </Link>
            <Link href="/movies?sort=top_rated" className={`${btnGhost} px-7 text-base`}>
              หนังคะแนนสูงสุด
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-4 py-16 sm:px-6">
        {featured.length > 0 && (
          <section aria-labelledby="featured-h">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-flare">คะแนนจากสมาชิก DOODI</p>
                <h2 id="featured-h" className="text-3xl font-bold sm:text-4xl">
                  หนังเด่นที่คนดูยกนิ้ว
                </h2>
              </div>
              <Link href="/movies?sort=top_rated" className="shrink-0 text-sm font-semibold text-flare hover:underline">
                ดูทั้งหมด
              </Link>
            </div>
            <MovieGrid>
              {featured.map((m) => (
                <MovieCard key={m.movie_id} movie={m} />
              ))}
            </MovieGrid>
          </section>
        )}

        <section aria-labelledby="latest-h">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-flare">เพิ่มเข้ามาล่าสุด</p>
              <h2 id="latest-h" className="text-3xl font-bold sm:text-4xl">
                หนังใหม่ในระบบ
              </h2>
            </div>
            <Link href="/movies" className="shrink-0 text-sm font-semibold text-flare hover:underline">
              ดูทั้งหมด
            </Link>
          </div>
          {latest.items.length > 0 ? (
            <MovieGrid>
              {latest.items.map((m) => (
                <MovieCard key={m.movie_id} movie={m} />
              ))}
            </MovieGrid>
          ) : (
            <p className="rounded-2xl border border-line bg-surface p-10 text-center text-muted">
              ยังไม่มีหนังในระบบ
            </p>
          )}
        </section>
      </div>
    </>
  );
}
