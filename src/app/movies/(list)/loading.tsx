import { MovieGridSkeleton } from "@/components/MovieCard";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" role="status" aria-label="กำลังโหลด">
      <div className="skeleton h-10 w-56 rounded" />
      <div className="skeleton mt-8 h-28 rounded-2xl" />
      <div className="mt-10">
        <MovieGridSkeleton />
      </div>
    </div>
  );
}
