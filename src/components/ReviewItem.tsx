"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { ReviewDTO } from "@/lib/types";
import { Dialog } from "./Dialog";
import { StarRow } from "./Rating";
import { ReviewForm } from "./ReviewForm";
import { useToast } from "./Toast";
import { btnDanger, btnGhost, btnPrimary, btnSmall } from "./ui";

export function ReviewItem({
  review,
  canManage,
  isMine,
}: {
  review: ReviewDTO;
  canManage: boolean;
  isMine: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const edited = review.updated_at !== review.created_at;

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/reviews/${review.reviews_id}`, { method: "DELETE" });
      toast("success", "ลบรีวิวแล้ว");
      setConfirming(false);
      router.refresh();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "ลบรีวิวไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="rounded-2xl border border-flare/50 bg-surface p-5">
        <ReviewForm movieId={review.movie_id} existing={review} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-wine font-bold text-flare">
            {Array.from(review.author.display_name)[0]}
          </span>
          <div>
            <p className="font-semibold leading-tight">
              {review.author.display_name}
              {isMine && <span className="ml-2 rounded-full bg-wine px-2 py-0.5 text-xs font-medium text-cream">รีวิวของคุณ</span>}
            </p>
            <p className="text-xs text-muted">
              <time dateTime={review.created_at}>{formatDateTime(review.created_at)}</time>
              {edited && (
                <>
                  {" · "}แก้ไขเมื่อ <time dateTime={review.updated_at}>{formatDateTime(review.updated_at)}</time>
                </>
              )}
            </p>
          </div>
        </div>
        <StarRow value={review.rating} />
      </div>

      <div className="mt-4">
        {review.has_spoiler && !revealed ? (
          <div className="rounded-xl border border-dashed border-flare/60 bg-ink p-4">
            <p className="font-semibold text-flare">⚠ รีวิวนี้มีสปอยล์</p>
            <p className="mt-1 text-sm text-muted">เนื้อหาถูกซ่อนไว้ กดเมื่อพร้อมอ่าน</p>
            <button type="button" onClick={() => setRevealed(true)} className={`${btnGhost} ${btnSmall} mt-3`}>
              แสดงรีวิวที่มีสปอยล์
            </button>
          </div>
        ) : (
          <>
            {review.has_spoiler && (
              <p className="mb-2 text-xs font-semibold text-flare">
                ⚠ มีสปอยล์{" "}
                <button type="button" onClick={() => setRevealed(false)} className="ml-1 font-normal text-muted underline">
                  ซ่อนอีกครั้ง
                </button>
              </p>
            )}
            <p className="whitespace-pre-wrap break-words">{review.content}</p>
          </>
        )}
      </div>

      {canManage && (
        <div className="mt-4 flex gap-2 border-t border-line pt-4">
          <button type="button" onClick={() => setEditing(true)} className={`${btnGhost} ${btnSmall}`}>
            แก้ไข
          </button>
          <button type="button" onClick={() => setConfirming(true)} className={`${btnDanger} ${btnSmall}`}>
            ลบ
          </button>
        </div>
      )}

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="ลบรีวิวนี้?">
        <p className="text-muted">รีวิวจะถูกลบถาวรและคะแนนเฉลี่ยของหนังจะถูกคำนวณใหม่ ไม่สามารถกู้คืนได้</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={btnGhost}>
            ยกเลิก
          </button>
          <button type="button" onClick={remove} disabled={busy} className={btnPrimary}>
            {busy ? "กำลังลบ…" : "ลบรีวิว"}
          </button>
        </div>
      </Dialog>
    </li>
  );
}
