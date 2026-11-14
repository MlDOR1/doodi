"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useToast } from "./Toast";
import { btnGhost, btnSmall } from "./ui";

export function LogoutButton() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "ออกจากระบบไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={logout} disabled={busy} className={`${btnGhost} ${btnSmall}`}>
      {busy ? "กำลังออก…" : "ออกจากระบบ"}
    </button>
  );
}
