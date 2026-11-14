import { requireAdmin } from "@/server/auth";
import { created, paged, parseQuery, readJson, route } from "@/server/http";
import { createMovie, listMovies } from "@/server/movies";
import { createMovieSchema, movieListQuery } from "@/server/schemas";

export const GET = route(async (req) => {
  const { items, meta } = await listMovies(parseQuery(req, movieListQuery));
  return paged(items, meta);
});

export const POST = route(async (req) => {
  await requireAdmin(req);
  return created(await createMovie(await readJson(req, createMovieSchema)));
});
