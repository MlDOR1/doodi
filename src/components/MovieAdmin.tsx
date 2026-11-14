"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { api, ClientApiError } from "@/lib/api-client";
import type { MovieDTO } from "@/lib/types";
import { Dialog } from "./Dialog";
import { useToast } from "./Toast";
import { btnDanger, btnGhost, btnPrimary, btnSmall, fieldError, input, label } from "./ui";

function MovieForm({ movie, onDone }: { movie?: MovieDTO; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [v, setV] = useState({
    title: movie?.title ?? "",
    synopsis: movie?.synopsis ?? "",
    genre: movie?.genre ?? "",
    release_year: movie?.release_year?.toString() ?? "",
    poster_url: movie?.poster_url ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((cur) => ({ ...cur, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const year = v.release_year.trim();
    if (year && !/^\d{4}$/.test(year)) {
      setErrors({ release_year: "ปีที่ออกฉายต้องเป็นตัวเลข 4 หลัก เช่น 2024" });
      return;
    }
    if (!v.title.trim()) {
      setErrors({ title: "กรุณากรอกชื่อหนัง" });
      return;
    }
    setBusy(true);
    setErrors({});
    const body = {
      title: v.title,
      synopsis: v.synopsis,
      genre: v.genre,
      release_year: year ? Number(year) : null,
      poster_url: v.poster_url,
    };
    try {
      if (movie) await api(`/movies/${movie.movie_id}`, { method: "PATCH", body });
      else await api("/movies", { method: "POST", body });
      toast("success", movie ? "บันทึกข้อมูลหนังแล้ว" : "เพิ่มหนังเรียบร้อย");
      onDone();
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError && err.fields) setErrors(err.fields);
      toast("error", err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) =>
    errors[k] ? (
      <p id={`${uid}-${k}-e`} className={fieldError} role="alert">
        {errors[k]}
      </p>
    ) : null;
  const a = (k: string) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${uid}-${k}-e` : undefined });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor={`${uid}-title`} className={label}>
          ชื่อหนัง *
        </label>
        <input id={`${uid}-title`} value={v.title} onChange={set("title")} maxLength={255} className={input} {...a("title")} />
        {err("title")}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div>
          <label htmlFor={`${uid}-genre`} className={label}>
            ประเภท (คั่นด้วยเครื่องหมายจุลภาค)
          </label>
          <input id={`${uid}-genre`} value={v.genre} onChange={set("genre")} placeholder="ดราม่า,ตลก" maxLength={200} className={input} {...a("genre")} />
          {err("genre")}
        </div>
        <div>
          <label htmlFor={`${uid}-year`} className={label}>
            ปีที่ออกฉาย
          </label>
          <input id={`${uid}-year`} value={v.release_year} onChange={set("release_year")} inputMode="numeric" maxLength={4} className={input} {...a("release_year")} />
          {err("release_year")}
        </div>
      </div>
      <div>
        <label htmlFor={`${uid}-poster`} className={label}>
          ลิงก์โปสเตอร์ (URL)
        </label>
        <input id={`${uid}-poster`} type="url" value={v.poster_url} onChange={set("poster_url")} placeholder="https://…" maxLength={2048} className={input} {...a("poster_url")} />
        {err("poster_url")}
      </div>
      <div>
        <label htmlFor={`${uid}-syn`} className={label}>
          เรื่องย่อ
        </label>
        <textarea id={`${uid}-syn`} value={v.synopsis} onChange={set("synopsis")} rows={5} className={`${input} resize-y`} {...a("synopsis")} />
        {err("synopsis")}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} disabled={busy} className={btnGhost}>
          ยกเลิก
        </button>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
    </form>
  );
}

export function AddMovieButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
        + เพิ่มหนังเอง
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="เพิ่มหนังใหม่" wide>
        <MovieForm onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function MovieRowActions({ movie }: { movie: MovieDTO }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/movies/${movie.movie_id}`, { method: "DELETE" });
      toast("success", `ลบ “${movie.title}” แล้ว`);
      setMode(null);
      router.refresh();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={() => setMode("edit")} className={`${btnGhost} ${btnSmall}`} aria-label={`แก้ไข ${movie.title}`}>
        แก้ไข
      </button>
      <button type="button" onClick={() => setMode("delete")} className={`${btnDanger} ${btnSmall}`} aria-label={`ลบ ${movie.title}`}>
        ลบ
      </button>
      <Dialog open={mode === "edit"} onClose={() => setMode(null)} title="แก้ไขข้อมูลหนัง" wide>
        <MovieForm movie={movie} onDone={() => setMode(null)} />
      </Dialog>
      <Dialog open={mode === "delete"} onClose={() => setMode(null)} title="ลบหนังเรื่องนี้?">
        <p className="text-muted">
          “{movie.title}” จะถูกซ่อนจากหน้าเว็บ รายการอยากดู และรีวิวทั้งหมด ข้อมูลยังคงเก็บไว้ในฐานข้อมูล (soft delete)
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setMode(null)} disabled={busy} className={btnGhost}>
            ยกเลิก
          </button>
          <button type="button" onClick={remove} disabled={busy} className={btnPrimary}>
            {busy ? "กำลังลบ…" : "ยืนยันลบ"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
