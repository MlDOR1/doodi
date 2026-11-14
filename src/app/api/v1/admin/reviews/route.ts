import { requireAdmin } from "@/server/auth";
import { paged, parseQuery, route } from "@/server/http";
import { listAllReviews } from "@/server/reviews";
import { pageQuery } from "@/server/schemas";
import { z } from "zod";

const query = pageQuery(10).extend({ q: z.string().trim().max(100).optional() });

export const GET = route(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, query);
  const { items, meta } = await listAllReviews(q.q, q.page, q.page_size);
  return paged(items, meta);
});
