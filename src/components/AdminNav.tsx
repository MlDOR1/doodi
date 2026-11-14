"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "จัดการหนัง" },
  { href: "/admin/tmdb", label: "นำเข้าจาก TMDB" },
  { href: "/admin/reviews", label: "ดูแลรีวิว" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูผู้ดูแลระบบ" className="mt-6 flex gap-2 overflow-x-auto border-b border-line pb-px">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold ${
              active ? "border-crimson text-white" : "border-transparent text-muted hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
