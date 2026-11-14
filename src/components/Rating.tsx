import { formatRating } from "@/lib/format";

export function Star({ filled, className = "h-4 w-4" }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`${className} ${filled ? "text-flare" : "text-line"}`} fill="currentColor" aria-hidden="true">
      <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 15l-5.4 3 1.2-6L1.3 7.8l6.1-.7L10 1.5z" />
    </svg>
  );
}

export function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`ให้คะแนน ${value} จาก 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= value} />
      ))}
    </span>
  );
}

export function RatingBadge({ average, count }: { average: number | null; count: number }) {
  if (average === null) return <span className="text-sm text-muted">{formatRating(null)}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Star filled className="h-4 w-4" />
      <strong className="font-bold text-cream">{formatRating(average)}</strong>
      <span className="text-muted">({count.toLocaleString("th-TH")} รีวิว)</span>
    </span>
  );
}
