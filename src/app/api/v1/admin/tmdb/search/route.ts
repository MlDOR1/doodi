import { requireAdmin } from "@/server/auth";
import { paged, parseQuery, route } from "@/server/http";
import { tmdbSearchQuery } from "@/server/schemas";
import { searchTmdb } from "@/server/tmdb";

export const GET = route(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, tmdbSearchQuery);
  const { items, meta } = await searchTmdb(q.query, q.page);
  return paged(items, meta);
});
