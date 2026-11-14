"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ClientApiError } from "@/lib/api-client";
import type { MovieDTO, PageMeta } from "@/lib/types";
import { Poster } from "./Poster";
import { useToast } from "./Toast";
import { btnGhost, btnPrimary, btnSmall, input, label } from "./ui";

interface Result {
  tmdb_id: number;
  title: string;
  original_title: string | null;
  overview: string | null;
  release_year: number | null;
  poster_url: string | null;
  genre: string | null;
  already_imported: boolean;
}

export function TmdbImporter({ configured }: { configured: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState<number | null>(null);
  const [imported, setImported] = useState<Record<number, number>>({});

  async function search(q: string, page = 1) {
    if (searching || !q.trim()) return;
    setSearching(true);
    setError("");
    try {
      const res = await api<{ data: Result[]; meta: PageMeta }>(`/admin/tmdb/search?query=${encodeURIComponent(q.trim())}&page=${page}`);
      setResults(res.data);
      setMeta(res.meta);
      setLastQuery(q.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "ค้นหาไม่สำเร็จ");
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  async function doImport(r: Result) {
    if (importing !== null) return;
    setImporting(r.tmdb_id);
    try {
      const res = await api<{ data: MovieDTO }>("/admin/tmdb/import", { method: "POST", body: { tmdb_id: r.tmdb_id } });
      setImported((cur) => ({ ...cur, [r.tmdb_id]: res.data.movie_id }));
      toast("success", `นำเข้า “${res.data.title}” เรียบร้อย`);
      router.refresh();
    } catch (e) {
      if (e instanceof ClientApiError && e.code === "tmdb_already_imported") {
        setResults((cur) => cur?.map((x) => (x.tmdb_id === r.tmdb_id ? { ...x, already_imported: true } : x)) ?? null);
      }
      toast("error", e instanceof Error ? e.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setImporting(null);
    }
  }

  if (!configured) {
    return (
      <div role="status" className="rounded-2xl border border-flare/40 bg-surface p-6">
        <h2 className="text-xl font-bold">ยังไม่ได้ตั้งค่า TMDB</h2>
        <p className="mt-2 max-w-prose text-muted">
          ฟีเจอร์ค้นหาและนำเข้าหนังจาก TMDB ต้องใช้ API Read Access Token ฝั่งเซิร์ฟเวอร์ เว็บไซต์ส่วนอื่นยังใช้งานได้ตามปกติ
          และคุณยังเพิ่มหนังเองได้ที่แท็บ “จัดการหนัง”
        </p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-cream/90">
          <li>สมัครบัญชีที่ themoviedb.org แล้วขอ API ที่หน้า Settings → API</li>
          <li>
            คัดลอก <strong>API Read Access Token</strong> (ยาว ๆ ขึ้นต้นด้วย eyJ…) ไม่ใช่ API Key สั้น
          </li>
          <li>
            ใส่ในไฟล์ <code className="rounded bg-raised px-1.5 py-0.5">.env</code> เป็น{" "}
            <code className="rounded bg-raised px-1.5 py-0.5">TMDB_API_READ_ACCESS_TOKEN=…</code> แล้วรีสตาร์ตเซิร์ฟเวอร์
          </li>
        </ol>
      </div>
    );
  }

  return (
    <section aria-labelledby="tmdb-h">
      <h2 id="tmdb-h" className="text-2xl font-bold">
        ค้นหาและนำเข้าจาก TMDB
      </h2>
      <p className="mt-1 text-sm text-muted">ระบบจะดึงข้อมูลภาษาไทยก่อน และใช้ภาษาอังกฤษเมื่อไม่มีข้อมูลภาษาไทย</p>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
        className="mt-5 flex flex-wrap items-end gap-2"
      >
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="tmdb-q" className={label}>
            ชื่อหนัง
          </label>
          <input id="tmdb-q" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} placeholder="เช่น Parasite หรือ หลานม่า" className={input} />
        </div>
        <button type="submit" disabled={searching || !query.trim()} className={btnPrimary}>
          {searching ? "กำลังค้นหา…" : "ค้นหา"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-5 rounded-lg border border-crimson-strong bg-wine px-4 py-3 text-sm text-white">
          {error}
        </p>
      )}

      {results && results.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-muted">
          ไม่พบผลลัพธ์สำหรับ “{lastQuery}”
        </p>
      )}

      {results && results.length > 0 && (
        <>
          <ul className="mt-6 grid gap-4 lg:grid-cols-2">
            {results.map((r) => {
              const done = r.already_imported || imported[r.tmdb_id] !== undefined;
              return (
                <li key={r.tmdb_id} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
                  <div className="w-20 shrink-0 self-start overflow-hidden rounded-lg">
                    <Poster src={r.poster_url} title={r.title} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="font-bold leading-snug">
                      {r.title} <span className="font-normal text-muted">{r.release_year ? `(${r.release_year})` : ""}</span>
                    </h3>
                    {r.original_title && r.original_title !== r.title && <p className="text-xs text-muted">{r.original_title}</p>}
                    <p className="mt-1 line-clamp-3 text-sm text-cream/80">{r.overview ?? "ไม่มีเรื่องย่อ"}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                      {done ? (
                        <>
                          <span className="rounded-full bg-wine px-3 py-1 text-xs font-semibold">นำเข้าแล้ว</span>
                          {imported[r.tmdb_id] && (
                            <Link href={`/movies/${imported[r.tmdb_id]}`} className={`${btnGhost} ${btnSmall}`}>
                              ดูหน้าหนัง
                            </Link>
                          )}
                        </>
                      ) : (
                        <button type="button" onClick={() => doImport(r)} disabled={importing !== null} className={`${btnPrimary} ${btnSmall}`}>
                          {importing === r.tmdb_id ? "กำลังนำเข้า…" : "นำเข้า"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {meta && meta.total_pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button type="button" disabled={searching || meta.page <= 1} onClick={() => search(lastQuery, meta.page - 1)} className={btnGhost}>
                ก่อนหน้า
              </button>
              <span className="text-sm text-muted">
                หน้า {meta.page} / {meta.total_pages}
              </span>
              <button type="button" disabled={searching || meta.page >= meta.total_pages} onClick={() => search(lastQuery, meta.page + 1)} className={btnGhost}>
                ถัดไป
              </button>
            </div>
          )}
        </>
      )}
      <p className="mt-8 text-xs text-muted">ผลิตภัณฑ์นี้ใช้ TMDB API แต่ไม่ได้รับการรับรองหรือรับรองโดย TMDB</p>
    </section>
  );
}
