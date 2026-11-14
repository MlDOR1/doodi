import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { prisma } from "./db";
import { ApiError } from "./http";
import type { Role, UserDTO } from "@/lib/types";

export const SESSION_COOKIE = "doodi_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

const userSelect = { id: true, displayName: true, email: true, role: true, createdAt: true } as const;
type UserRow = { id: number; displayName: string; email: string; role: Role; createdAt: Date };

export const toUserDTO = (u: UserRow): UserDTO => ({
  user_id: u.id,
  display_name: u.displayName,
  email: u.email,
  role: u.role,
  created_at: u.createdAt.toISOString(),
});

export const hashPassword = (pw: string) => argon2.hash(pw);
export const verifyPassword = (hash: string, pw: string) => argon2.verify(hash, pw).catch(() => false);

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + MAX_AGE_SEC * 1000) },
  });
  prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
  return token;
}

export async function destroySession(token: string | null) {
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}

export async function userFromToken(token: string | null | undefined): Promise<UserDTO | null> {
  if (!token || token.length > 128) return null;
  const s = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    select: { expiresAt: true, user: { select: userSelect } },
  });
  if (!s || s.expiresAt < new Date()) return null;
  return toUserDTO(s.user);
}

export function cookieHeader(token: string | null): string {
  const parts = [
    `${SESSION_COOKIE}=${token ?? ""}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${token ? MAX_AGE_SEC : 0}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === SESSION_COOKIE) return part.slice(i + 1).trim();
  }
  return null;
}

export const currentUser = (req: Request) => userFromToken(tokenFromRequest(req));

export async function requireUser(req: Request): Promise<UserDTO> {
  const u = await currentUser(req);
  if (!u) throw new ApiError(401, "unauthenticated", "กรุณาเข้าสู่ระบบก่อน");
  return u;
}

export async function requireAdmin(req: Request): Promise<UserDTO> {
  const u = await requireUser(req);
  if (u.role !== "admin") throw new ApiError(403, "forbidden", "ต้องเป็นผู้ดูแลระบบเท่านั้น");
  return u;
}
