import { Brand } from "./Brand";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <Brand />
          <p className="max-w-md text-sm text-muted">
            ชุมชนรีวิวหนังสำหรับคนไทย อ่านความเห็นจริง เปรียบเทียบคะแนน แล้วเลือกหนังที่คุ้มค่าเวลาของคุณ
          </p>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-muted">
          ข้อมูลหนังและโปสเตอร์ที่นำเข้าอัตโนมัติมาจาก TMDB ผลิตภัณฑ์นี้ใช้ TMDB API แต่ไม่ได้รับการรับรองหรือรับรองโดย TMDB
          คะแนนที่แสดงบนเว็บไซต์คือคะแนนจากสมาชิก DOODI เท่านั้น
          <br />
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-cream underline underline-offset-2 hover:text-flare">
            themoviedb.org
          </a>
        </p>
      </div>
    </footer>
  );
}
