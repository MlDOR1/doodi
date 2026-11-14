import Link from "next/link";
import { btnPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-7xl font-bold text-crimson">404</p>
      <h1 className="mt-4 text-2xl font-bold">ไม่พบหน้าที่ต้องการ</h1>
      <p className="mt-2 text-muted">หน้านี้อาจถูกลบหรือไม่เคยมีอยู่ ลองกลับไปเลือกหนังจากหน้าแรกดูนะ</p>
      <Link href="/movies" className={`${btnPrimary} mt-8`}>
        ดูหนังทั้งหมด
      </Link>
    </div>
  );
}
