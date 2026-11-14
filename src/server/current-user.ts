import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, userFromToken } from "./auth";

/** For server components: the signed-in user, deduplicated per request. */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  return userFromToken(store.get(SESSION_COOKIE)?.value);
});

export async function requireUserPage(next: string) {
  const u = await getCurrentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

export async function requireAdminPage() {
  const u = await requireUserPage("/admin");
  if (u.role !== "admin") redirect("/");
  return u;
}
