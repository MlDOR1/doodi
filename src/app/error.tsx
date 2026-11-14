"use client";

import { btnGhost, btnPrimary } from "@/components/ui";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">เกิดข้อผิดพลาดบางอย่าง</h1>
      <p className="mt-2 text-muted">โหลดหน้านี้ไม่สำเร็จ ลองใหม่อีกครั้ง หากยังไม่หายให้กลับมาใหม่ภายหลัง</p>
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" onClick={reset} className={btnPrimary}>
          ลองใหม่
        </button>
        <Link href="/" className={btnGhost}>
          กลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}
