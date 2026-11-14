import Link from "next/link";

function pagesToShow(page: number, total: number): (number | "gap")[] {
  const set = new Set([1, total, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

export function Pagination({
  basePath,
  params,
  page,
  totalPages,
  pageParam = "page",
  hash,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  pageParam?: string;
  hash?: string;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set(pageParam, String(p));
    const qs = sp.toString();
    return `${basePath}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
  };
  const item = "inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold";
  return (
    <nav aria-label="เลือกหน้า" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} className={`${item} border-line bg-raised hover:border-flare`} rel="prev">
          ก่อนหน้า
        </Link>
      )}
      {pagesToShow(page, totalPages).map((n, i) =>
        n === "gap" ? (
          <span key={`g${i}`} aria-hidden="true" className="px-1 text-muted">
            …
          </span>
        ) : n === page ? (
          <span key={n} aria-current="page" className={`${item} border-crimson-strong bg-crimson-strong text-white`}>
            {n}
          </span>
        ) : (
          <Link key={n} href={href(n)} aria-label={`หน้า ${n}`} className={`${item} border-line bg-raised hover:border-flare`}>
            {n}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link href={href(page + 1)} className={`${item} border-line bg-raised hover:border-flare`} rel="next">
          ถัดไป
        </Link>
      )}
    </nav>
  );
}
