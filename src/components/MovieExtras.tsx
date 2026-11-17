"use client";

/* eslint-disable @next/next/no-img-element -- profile and provider images use TMDB's external CDN */
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { MovieCreditsDTO, MovieVideoDTO, RecommendedMovieDTO, WatchProvidersDTO } from "@/lib/types";
import { Poster } from "./Poster";
import { btnGhost } from "./ui";

type Extras = {
  credits: MovieCreditsDTO | null;
  videos: MovieVideoDTO[] | null;
  recommendations: RecommendedMovieDTO[] | null;
  providers: WatchProvidersDTO | null;
};

export function MovieExtras({ movieId }: { movieId: number }) {
  const [data, setData] = useState<Extras | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api<{ data: MovieCreditsDTO }>(`/movies/${movieId}/credits`),
      api<{ data: MovieVideoDTO[] }>(`/movies/${movieId}/videos`),
      api<{ data: RecommendedMovieDTO[] }>(`/movies/${movieId}/recommendations`),
      api<{ data: WatchProvidersDTO }>(`/movies/${movieId}/watch-providers`),
    ]).then(([credits, videos, recommendations, providers]) => {
      if (!active) return;
      setData({
        credits: credits.status === "fulfilled" ? credits.value.data : null,
        videos: videos.status === "fulfilled" ? videos.value.data : null,
        recommendations: recommendations.status === "fulfilled" ? recommendations.value.data : null,
        providers: providers.status === "fulfilled" ? providers.value.data : null,
      });
      setFailed([credits, videos, recommendations, providers].some((result) => result.status === "rejected"));
      setLoading(false);
    });
    return () => { active = false; };
  }, [movieId, attempt]);

  return (
    <div className="mt-8 space-y-12">
      {loading && <p role="status" className="text-muted">กำลังโหลดนักแสดง ตัวอย่างหนัง และข้อมูลเพิ่มเติม…</p>}
      {failed && !loading && <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-muted">
        <p>โหลดข้อมูลเพิ่มเติมบางส่วนไม่สำเร็จ</p>
        <button type="button" onClick={() => { setLoading(true); setAttempt((value) => value + 1); }} className={btnGhost}>ลองอีกครั้ง</button>
      </div>}

      {data?.credits && <section aria-labelledby="cast-heading">
        <h2 id="cast-heading" className="text-2xl font-bold">นักแสดงและผู้กำกับ</h2>
        {data.credits.directors.length > 0 && <p className="mt-2 text-muted">ผู้กำกับ {data.credits.directors.map((person) => person.name).join(", ")}</p>}
        {data.credits.cast.length ? <ul className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-6">
          {data.credits.cast.map((person) => <li key={person.person_id} className="min-w-0">
            {person.profile_url
              ? <img src={person.profile_url} alt={person.name} loading="lazy" className="aspect-[2/3] w-full rounded-xl bg-raised object-cover" />
              : <div className="flex aspect-[2/3] items-center justify-center rounded-xl bg-raised p-4 text-center text-sm text-muted">{person.name}</div>}
            <p className="mt-2 font-semibold">{person.name}</p>
            {person.character && <p className="mt-1 text-sm text-muted">{person.character}</p>}
          </li>)}
        </ul> : <p className="mt-3 text-muted">ยังไม่มีข้อมูลนักแสดง</p>}
      </section>}

      {data?.videos && <section aria-labelledby="trailer-heading">
        <h2 id="trailer-heading" className="text-2xl font-bold">ตัวอย่างหนัง</h2>
        {data.videos.length ? <>
          <iframe src={data.videos[0].embed_url} title={data.videos[0].name} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="mt-5 aspect-video w-full rounded-2xl border border-line" />
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {data.videos.map((video) => <li key={video.url}><a href={video.url} target="_blank" rel="noreferrer" className="text-flare underline underline-offset-4">{video.name}</a></li>)}
          </ul>
        </> : <p className="mt-3 text-muted">ยังไม่มีตัวอย่างหนังที่พร้อมแสดง</p>}
      </section>}

      {data?.providers && <section aria-labelledby="providers-heading">
        <h2 id="providers-heading" className="text-2xl font-bold">ช่องทางรับชมในไทย</h2>
        {data.providers.groups.length ? <div className="mt-5 space-y-5">
          {data.providers.groups.map((group) => <div key={group.type}>
            <h3 className="font-semibold">{group.label}</h3>
            <ul className="mt-2 flex flex-wrap gap-4">
              {group.providers.map((provider) => <li key={provider.provider_id} className="flex items-center gap-2 text-sm">
                {provider.logo_url && <img src={provider.logo_url} alt="" loading="lazy" width={36} height={36} className="rounded-lg" />}
                {provider.name}
              </li>)}
            </ul>
          </div>)}
          {data.providers.link && <a href={data.providers.link} target="_blank" rel="noreferrer" className="inline-block text-sm text-flare underline underline-offset-4">ดูรายละเอียดช่องทางรับชม</a>}
        </div> : <p className="mt-3 text-muted">ยังไม่มีข้อมูลช่องทางรับชมในประเทศไทยสำหรับเรื่องนี้</p>}
        <p className="mt-4 text-xs text-muted">ข้อมูลช่องทางรับชมจาก <a href="https://www.justwatch.com/th" target="_blank" rel="noreferrer" className="underline">JustWatch</a> ผ่าน TMDB ความพร้อมให้บริการอาจเปลี่ยนแปลงได้</p>
      </section>}

      {data?.recommendations && <section aria-labelledby="recommendations-heading">
        <h2 id="recommendations-heading" className="text-2xl font-bold">หนังที่แนะนำจาก TMDB</h2>
        {data.recommendations.length ? <ul className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {data.recommendations.map((movie) => <li key={movie.tmdb_id}>
            <Link href={movie.movie_id ? `/movies/${movie.movie_id}` : movie.url} target={movie.movie_id ? undefined : "_blank"} rel={movie.movie_id ? undefined : "noreferrer"} className="group block">
              <div className="overflow-hidden rounded-xl border border-line group-hover:border-flare"><Poster src={movie.poster_url} title={movie.title} /></div>
              <h3 className="mt-2 font-semibold group-hover:text-flare">{movie.title}</h3>
              <p className="mt-1 text-sm text-muted">{movie.release_year ?? "ไม่ระบุปี"}{movie.movie_id === null && " · ดูข้อมูลบน TMDB"}</p>
            </Link>
          </li>)}
        </ul> : <p className="mt-3 text-muted">ยังไม่มีหนังแนะนำสำหรับเรื่องนี้</p>}
      </section>}
    </div>
  );
}
