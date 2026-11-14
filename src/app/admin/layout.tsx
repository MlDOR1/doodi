import type { Metadata } from "next";
import { requireAdminPage } from "@/server/current-user";
import { AdminNav } from "@/components/AdminNav";

export const metadata: Metadata = { title: "จัดการระบบ" };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-flare">Admin</p>
      <h1 className="text-3xl font-bold sm:text-4xl">จัดการระบบ DOODI</h1>
      <AdminNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
