import { prisma } from "@/server/db";
import { createSession, cookieHeader, hashPassword, toUserDTO, verifyPassword } from "@/server/auth";
import { ApiError, ok, readJson, route } from "@/server/http";
import { clientIp, rateLimit } from "@/server/ratelimit";
import { loginSchema } from "@/server/schemas";

// Verified against when the email is unknown, so response time does not reveal which emails exist.
let dummyHash: Promise<string> | null = null;

export const POST = route(async (req) => {
  const ip = clientIp(req);
  rateLimit(`login-ip:${ip}`, 30, 15 * 60 * 1000);
  const input = await readJson(req, loginSchema);
  rateLimit(`login-email:${input.email}`, 8, 15 * 60 * 1000);

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const hash = user?.passwordHash ?? (await (dummyHash ??= hashPassword("doodi-dummy-password")));
  const valid = await verifyPassword(hash, input.password);
  if (!user || !valid) throw new ApiError(401, "invalid_credentials", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");

  const token = await createSession(user.id);
  return ok(toUserDTO(user), { "Set-Cookie": cookieHeader(token) });
});
