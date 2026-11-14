import { requireUser } from "@/server/auth";
import { created, idParam, paged, parseQuery, readJson, route } from "@/server/http";
import { createReview, listReviews } from "@/server/reviews";
import { createReviewSchema, pageQuery } from "@/server/schemas";

export const GET = route(async (req, params) => {
  const q = parseQuery(req, pageQuery(10));
  const { items, meta } = await listReviews(idParam(params), q.page, q.page_size);
  return paged(items, meta);
});

export const POST = route(async (req, params) => {
  const user = await requireUser(req);
  const movieId = idParam(params);
  return created(await createReview(user, movieId, await readJson(req, createReviewSchema)));
});
