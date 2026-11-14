import { cookieHeader, destroySession, tokenFromRequest } from "@/server/auth";
import { noContent, route } from "@/server/http";

export const POST = route(async (req) => {
  await destroySession(tokenFromRequest(req));
  return noContent({ "Set-Cookie": cookieHeader(null) });
});
