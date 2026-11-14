import { requireUser } from "@/server/auth";
import { idParam, noContent, ok, readJson, route } from "@/server/http";
import { deleteReview, updateReview } from "@/server/reviews";
import { updateReviewSchema } from "@/server/schemas";

export const PATCH = route(async (req, params) => {
  const user = await requireUser(req);
  const id = idParam(params);
  return ok(await updateReview(user, id, await readJson(req, updateReviewSchema)));
});

export const DELETE = route(async (req, params) => {
  const user = await requireUser(req);
  await deleteReview(user, idParam(params));
  return noContent();
});
