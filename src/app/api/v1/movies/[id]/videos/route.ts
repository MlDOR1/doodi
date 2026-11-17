import { idParam, ok, route } from "@/server/http";
import { movieVideos } from "@/server/tmdb";

export const GET = route(async (_req, params) => ok(await movieVideos(idParam(params))));
