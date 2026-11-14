import Link from "next/link";

export function Brand({ size = "md" }: { size?: "md" | "xl" }) {
  const big = size === "xl";
  return (
    <span className="inline-flex flex-col leading-none font-display font-bold uppercase">
      <span className={`${big ? "text-6xl sm:text-8xl" : "text-xl"} tracking-tight text-white`}>DOODI</span>
      <span className={`${big ? "mt-1 text-2xl sm:text-4xl tracking-[0.04em]" : "text-[0.62rem] tracking-[0.22em]"} text-crimson`}>
        MOVIE REVIEW
      </span>
    </span>
  );
}

export function BrandLink() {
  return (
    <Link href="/" aria-label="DOODI Movie Review หน้าแรก" className="shrink-0">
      <Brand />
    </Link>
  );
}
