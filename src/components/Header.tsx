import Link from "next/link";
import { getCurrentUser } from "@/server/current-user";
import { BrandLink } from "./Brand";
import { LogoutButton } from "./LogoutButton";
import { btnGhost, btnPrimary, btnSmall } from "./ui";

const navLink = "rounded-full px-3 py-2 text-sm font-medium text-cream/90 hover:bg-raised hover:text-white";

export async function Header() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur">
      <a
        href="#main"
        className="absolute left-3 top-3 z-50 -translate-y-20 rounded-lg bg-white px-4 py-2 font-semibold text-ink focus:translate-y-0"
      >
        ข้ามไปที่เนื้อหา
      </a>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <BrandLink />
        <nav aria-label="เมนูหลัก" className="order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto">
          <Link href="/movies" className={navLink}>
            หนังทั้งหมด
          </Link>
          {user && (
            <Link href="/watchlist" className={navLink}>
              รายการอยากดู
            </Link>
          )}
        </nav>
        <form action="/movies" role="search" className="order-2 ml-auto hidden min-w-0 flex-1 sm:order-none sm:ml-0 sm:flex sm:max-w-xs">
          <label htmlFor="header-search" className="sr-only">
            ค้นหาหนังจากชื่อ
          </label>
          <input
            id="header-search"
            name="q"
            type="search"
            placeholder="ค้นหาชื่อหนัง"
            maxLength={100}
            className="w-full rounded-full border border-line bg-surface px-4 py-2 text-sm placeholder:text-muted/70 focus:border-flare"
          />
        </form>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              {user.role === "admin" && (
                <Link href="/admin" className={`${btnPrimary} ${btnSmall}`}>
                  จัดการระบบ
                </Link>
              )}
              <span className="hidden max-w-[10rem] truncate text-sm text-muted md:inline" title={user.email}>
                {user.display_name}
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className={`${btnGhost} ${btnSmall}`}>
                เข้าสู่ระบบ
              </Link>
              <Link href="/register" className={`${btnPrimary} ${btnSmall}`}>
                สมัครสมาชิก
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
