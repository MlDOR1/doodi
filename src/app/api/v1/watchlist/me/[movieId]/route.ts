import { requireUser } from "@/server/auth";
import { idParam, noContent, route } from "@/server/http";
import { removeFromWatchlist } from "@/server/watchlist";

export const DELETE = route(async (req, params) => {
  const user = await requireUser(req);
  await removeFromWatchlist(user.user_id, idParam(params, "movieId"));
  return noContent();
});
