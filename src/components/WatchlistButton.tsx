"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ClientApiError } from "@/lib/api-client";
import { useToast } from "./Toast";
import { btnGhost, btnSmall } from "./ui";

export function WatchlistButton({
  movieId,
  initialSaved,
  signedIn,
  loginHref,
  compact,
  onRemoved,
}: {
  movieId: number;
  initialSaved: boolean;
  signedIn: boolean;
  loginHref: string;
  compact?: boolean;
  onRemoved?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    if (!signedIn) {
      router.push(loginHref);
      return;
    }
    setBusy(true);
    try {
      if (saved) {
        await api(`/watchlist/me/${movieId}`, { method: "DELETE" });
        setSaved(false);
        toast("success", "นำออกจากรายการอยากดูแล้ว");
        onRemoved?.();
      } else {
        await api("/watchlist/me", { method: "POST", body: { movie_id: movieId } });
        setSaved(true);
        toast("success", "เพิ่มในรายการอยากดูแล้ว");
      }
      router.refresh();
    } catch (e) {
      if (e instanceof ClientApiError && e.code === "already_in_watchlist") setSaved(true);
      else if (e instanceof ClientApiError && e.code === "not_in_watchlist") setSaved(false);
      else if (e instanceof ClientApiError && e.status === 401) {
        router.push(loginHref);
        return;
      }
      toast("error", e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const size = compact ? btnSmall : "";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={signedIn ? saved : undefined}
      className={`${btnGhost} ${size}`}
    >
      {busy ? "กำลังบันทึก…" : saved ? (compact ? "นำออก" : "✓ อยู่ในรายการอยากดู · นำออก") : "+ เพิ่มในรายการอยากดู"}
    </button>
  );
}
