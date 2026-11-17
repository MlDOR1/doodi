import { idParam, ok, route } from "@/server/http";
import { movieWatchProviders } from "@/server/tmdb";

export const GET = route(async (_req, params) => ok(await movieWatchProviders(idParam(params))));
