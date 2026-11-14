import { ApiError, ok, route } from "@/server/http";
import { importCurrent } from "@/server/tmdb";

// Called daily by Vercel Cron (see vercel.json), which sends `Authorization: Bearer $CRON_SECRET`.
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError(503, "cron_not_configured", "CRON_SECRET is not set");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) throw new ApiError(401, "unauthorized", "Unauthorized");
  return ok(await importCurrent());
});
