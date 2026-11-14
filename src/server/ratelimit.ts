import { ApiError } from "./http";

// ponytail: in-process sliding window; one server instance only. Use Redis/edge limits when scaling out.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    const retry = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    throw new ApiError(429, "rate_limited", `ลองบ่อยเกินไป กรุณารอ ${retry} วินาทีแล้วลองใหม่`, undefined, {
      "Retry-After": String(retry),
    });
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
}

export const resetRateLimits = () => hits.clear();

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
