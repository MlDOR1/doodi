const dateFmt = new Intl.DateTimeFormat("th-TH-u-ca-gregory", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const dateTimeFmt = new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
export const formatRating = (v: number | null) => (v === null ? "ยังไม่มีคะแนน" : v.toFixed(1));
export const genreList = (g: string | null) => (g ? g.split(",").filter(Boolean) : []);

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(next: string | string[] | undefined | null, fallback = "/"): string {
  const v = Array.isArray(next) ? next[0] : next;
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  return v;
}
