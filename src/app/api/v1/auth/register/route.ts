import { prisma } from "@/server/db";
import { createSession, cookieHeader, hashPassword, toUserDTO } from "@/server/auth";
import { ApiError, created, isUniqueViolation, readJson, route } from "@/server/http";
import { clientIp, rateLimit } from "@/server/ratelimit";
import { registerSchema } from "@/server/schemas";

export const POST = route(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const input = await readJson(req, registerSchema);

  if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    throw new ApiError(409, "email_taken", "อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว", { email: "อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว" });
  }

  try {
    // role is never read from the request body: public registration always yields a member
    const user = await prisma.user.create({
      data: {
        displayName: input.display_name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: "member",
      },
    });
    const token = await createSession(user.id);
    return created(toUserDTO(user), { "Set-Cookie": cookieHeader(token) });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ApiError(409, "email_taken", "อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว", { email: "อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว" });
    }
    throw e;
  }
});
