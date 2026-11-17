import { idParam, ok, route } from "@/server/http";
import { movieCredits } from "@/server/tmdb";

export const GET = route(async (_req, params) => ok(await movieCredits(idParam(params))));
