import Link from "next/link";
import type { MovieDTO } from "@/lib/types";
import { genreList } from "@/lib/format";
import { Poster } from "./Poster";
import { RatingBadge } from "./Rating";

export function MovieCard({ movie, actions }: { movie: MovieDTO; actions?: React.ReactNode }) {
  const genres = genreList(movie.genre);
  return (
    <article className="group flex flex-col">
      <Link
        href={`/movies/${movie.movie_id}`}
        className="lift block overflow-hidden rounded-xl border border-line bg-surface group-hover:border-flare/70"
      >
        <Poster src={movie.poster_url} title={movie.title} />
      </Link>
      <div className="mt-3 flex flex-1 flex-col gap-1">
        <h3 className="line-clamp-2 text-base font-bold leading-snug">
          <Link href={`/movies/${movie.movie_id}`} className="hover:text-flare">
            {movie.title}
          </Link>
        </h3>
        <p className="text-sm text-muted">
          {movie.release_year ?? "ไม่ระบุปี"}
          {genres.length > 0 && <span> · {genres.slice(0, 2).join(" / ")}</span>}
        </p>
        <RatingBadge average={movie.average_rating} count={movie.review_count} />
        {actions && <div className="mt-2">{actions}</div>}
      </div>
    </article>
  );
}

export function MovieGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-x-5">{children}</div>;
}

export function MovieGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <MovieGrid>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden="true">
          <div className="skeleton aspect-[2/3] rounded-xl" />
          <div className="skeleton mt-3 h-4 w-3/4 rounded" />
          <div className="skeleton mt-2 h-3 w-1/2 rounded" />
        </div>
      ))}
    </MovieGrid>
  );
}
