import { idParam, ok, route } from "@/server/http";
import { movieRecommendations } from "@/server/tmdb";

export const GET = route(async (_req, params) => ok(await movieRecommendations(idParam(params))));
