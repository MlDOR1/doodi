"use client";

import { useState } from "react";

export function Poster({ src, title, className = "" }: { src: string | null; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <div className={`poster-fallback relative aspect-[2/3] w-full overflow-hidden bg-raised ${className}`}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- posters may come from any admin-entered host
        <img
          src={src}
          alt={`โปสเตอร์ ${title}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div role="img" aria-label={`ไม่มีโปสเตอร์ ${title}`} className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-flare/80" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
          </svg>
          <span className="line-clamp-4 text-sm font-semibold text-cream/90">{title}</span>
        </div>
      )}
    </div>
  );
}
