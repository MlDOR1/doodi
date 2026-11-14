import { requireUser } from "@/server/auth";
import { created, paged, parseQuery, readJson, route } from "@/server/http";
import { pageQuery, watchlistAddSchema } from "@/server/schemas";
import { addToWatchlist, listWatchlist } from "@/server/watchlist";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const q = parseQuery(req, pageQuery(12));
  const { items, meta } = await listWatchlist(user.user_id, q.page, q.page_size);
  return paged(items, meta);
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { movie_id } = await readJson(req, watchlistAddSchema);
  return created(await addToWatchlist(user.user_id, movie_id));
});
