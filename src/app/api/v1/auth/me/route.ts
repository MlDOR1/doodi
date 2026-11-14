import { requireUser } from "@/server/auth";
import { ok, route } from "@/server/http";

export const GET = route(async (req) => ok(await requireUser(req)));
