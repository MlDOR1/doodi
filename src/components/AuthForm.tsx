"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { api, ClientApiError } from "@/lib/api-client";
import { useToast } from "./Toast";
import { btnPrimary, fieldError, input, label } from "./ui";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const isRegister = mode === "register";
  const [values, setValues] = useState({ display_name: "", email: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const local: Record<string, string> = {};
    if (isRegister && values.display_name.trim().length < 2) local.display_name = "ชื่อที่แสดงต้องมีอย่างน้อย 2 ตัวอักษร";
    if (!values.email.trim()) local.email = "กรุณากรอกอีเมล";
    if (!values.password) local.password = "กรุณากรอกรหัสผ่าน";
    else if (isRegister && values.password.length < 8) local.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    if (isRegister && values.password !== values.password_confirmation) {
      local.password_confirmation = "รหัสผ่านและการยืนยันไม่ตรงกัน";
    }
    setErrors(local);
    setFormError("");
    if (Object.keys(local).length) return;

    setBusy(true);
    try {
      await api(isRegister ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: isRegister ? values : { email: values.email, password: values.password },
      });
      toast("success", isRegister ? "สมัครสมาชิกสำเร็จ ยินดีต้อนรับสู่ DOODI" : "เข้าสู่ระบบสำเร็จ");
      router.push(next);
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError) {
        setErrors(err.fields ?? {});
        if (!err.fields || err.status === 401 || err.status === 429) setFormError(err.message);
      } else setFormError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setBusy(false);
    }
  }

  const field = (k: keyof typeof values, text: string, type: string, autoComplete: string) => (
    <div>
      <label htmlFor={`${uid}-${k}`} className={label}>
        {text}
      </label>
      <input
        id={`${uid}-${k}`}
        name={k}
        type={type}
        value={values[k]}
        onChange={set(k)}
        autoComplete={autoComplete}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `${uid}-${k}-err` : undefined}
        maxLength={k === "email" ? 255 : k === "display_name" ? 100 : 128}
        className={input}
      />
      {errors[k] && (
        <p id={`${uid}-${k}-err`} className={fieldError} role="alert">
          {errors[k]}
        </p>
      )}
    </div>
  );

  const nextQuery = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError && (
        <p role="alert" className="rounded-lg border border-crimson-strong bg-wine px-4 py-3 text-sm text-white">
          {formError}
        </p>
      )}
      {isRegister && field("display_name", "ชื่อที่แสดง", "text", "nickname")}
      {field("email", "อีเมล", "email", "email")}
      {field("password", "รหัสผ่าน", "password", isRegister ? "new-password" : "current-password")}
      {isRegister && field("password_confirmation", "ยืนยันรหัสผ่าน", "password", "new-password")}
      {isRegister && <p className="-mt-2 text-xs text-muted">รหัสผ่านอย่างน้อย 8 ตัวอักษร</p>}
      <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
        {busy ? "กำลังดำเนินการ…" : isRegister ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
      </button>
      <p className="text-center text-sm text-muted">
        {isRegister ? "มีบัญชีอยู่แล้ว?" : "ยังไม่มีบัญชี?"}{" "}
        <Link href={`${isRegister ? "/login" : "/register"}${nextQuery}`} className="font-semibold text-flare hover:underline">
          {isRegister ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </Link>
      </p>
    </form>
  );
}
