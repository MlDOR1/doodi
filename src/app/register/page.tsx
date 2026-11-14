import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Brand } from "@/components/Brand";
import { safeNext } from "@/lib/format";
import { getCurrentUser } from "@/server/current-user";

export const metadata: Metadata = { title: "สมัครสมาชิก" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="curtain">
      <div className="bg-gradient-to-b from-ink/80 to-ink/95 px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface/95 p-6 shadow-2xl sm:p-8">
          <Brand />
          <h1 className="mt-6 text-2xl font-bold">สมัครสมาชิก</h1>
          <p className="mb-6 mt-1 text-sm text-muted">สร้างบัญชีฟรี เพื่อรีวิวหนังและเก็บรายการอยากดู</p>
          <AuthForm mode="register" next={next} />
        </div>
      </div>
    </div>
  );
}
