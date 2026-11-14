import { requireAdmin } from "@/server/auth";
import { created, readJson, route } from "@/server/http";
import { tmdbImportSchema } from "@/server/schemas";
import { importTmdb } from "@/server/tmdb";

export const POST = route(async (req) => {
  await requireAdmin(req);
  const { tmdb_id } = await readJson(req, tmdbImportSchema);
  return created(await importTmdb(tmdb_id));
});
