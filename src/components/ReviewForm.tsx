"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { api, ClientApiError } from "@/lib/api-client";
import type { ReviewDTO } from "@/lib/types";
import { Star } from "./Rating";
import { useToast } from "./Toast";
import { btnGhost, btnPrimary, fieldError, input, label } from "./ui";

export function ReviewForm({
  movieId,
  existing,
  onDone,
}: {
  movieId: number;
  existing?: ReviewDTO;
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [content, setContent] = useState(existing?.content ?? "");
  const [spoiler, setSpoiler] = useState(existing?.has_spoiler ?? false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = !!existing;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const local: Record<string, string> = {};
    if (rating < 1) local.rating = "กรุณาเลือกคะแนน 1 ถึง 5 ดาว";
    if (content.trim().length < 5) local.content = "รีวิวต้องมีอย่างน้อย 5 ตัวอักษร";
    setErrors(local);
    if (Object.keys(local).length) return;

    setBusy(true);
    try {
      const body = { rating, content: content.trim(), has_spoiler: spoiler };
      if (editing) await api(`/reviews/${existing.reviews_id}`, { method: "PATCH", body });
      else await api(`/movies/${movieId}/reviews`, { method: "POST", body });
      toast("success", editing ? "บันทึกการแก้ไขรีวิวแล้ว" : "โพสต์รีวิวเรียบร้อย ขอบคุณที่แบ่งปัน");
      onDone?.();
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError && err.fields) setErrors(err.fields);
      if (err instanceof ClientApiError && err.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/movies/${movieId}`)}`);
        return;
      }
      toast("error", err instanceof Error ? err.message : "บันทึกรีวิวไม่สำเร็จ");
      if (err instanceof ClientApiError && err.code === "review_exists") router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset>
        <legend className={label}>คะแนนของคุณ</legend>
        <div className="flex gap-1" role="radiogroup" aria-describedby={errors.rating ? `${uid}-rating-err` : undefined}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded p-1 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-white">
              <input
                type="radio"
                name={`${uid}-rating`}
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
                aria-label={`${n} ดาว`}
              />
              <Star filled={n <= rating} className="h-8 w-8" />
            </label>
          ))}
        </div>
        {errors.rating && (
          <p id={`${uid}-rating-err`} className={fieldError} role="alert">
            {errors.rating}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor={`${uid}-content`} className={label}>
          รีวิวของคุณ
        </label>
        <textarea
          id={`${uid}-content`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          maxLength={5000}
          aria-invalid={!!errors.content}
          aria-describedby={errors.content ? `${uid}-content-err` : undefined}
          placeholder="เล่าให้คนอื่นฟังว่าหนังเรื่องนี้เป็นอย่างไร"
          className={`${input} resize-y`}
        />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{errors.content ? "" : "อย่างน้อย 5 ตัวอักษร"}</span>
          <span>{content.length.toLocaleString("th-TH")}/5,000</span>
        </div>
        {errors.content && (
          <p id={`${uid}-content-err`} className={fieldError} role="alert">
            {errors.content}
          </p>
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={spoiler}
          onChange={(e) => setSpoiler(e.target.checked)}
          className="mt-1 h-5 w-5 accent-crimson"
        />
        <span>
          <strong className="font-semibold">รีวิวนี้มีสปอยล์</strong>
          <span className="block text-muted">เนื้อหาจะถูกซ่อนไว้จนกว่าผู้อ่านจะกดเปิดดูเอง</span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "โพสต์รีวิว"}
        </button>
        {editing && onDone && (
          <button type="button" onClick={onDone} disabled={busy} className={btnGhost}>
            ยกเลิก
          </button>
        )}
      </div>
    </form>
  );
}
