import { requireAdmin } from "@/server/auth";
import { idParam, noContent, ok, readJson, route } from "@/server/http";
import { getMovieOr404, softDeleteMovie, updateMovie } from "@/server/movies";
import { updateMovieSchema } from "@/server/schemas";

export const GET = route(async (_req, params) => ok(await getMovieOr404(idParam(params))));

export const PATCH = route(async (req, params) => {
  await requireAdmin(req);
  const id = idParam(params);
  return ok(await updateMovie(id, await readJson(req, updateMovieSchema)));
});

export const DELETE = route(async (req, params) => {
  await requireAdmin(req);
  await softDeleteMovie(idParam(params));
  return noContent();
});
