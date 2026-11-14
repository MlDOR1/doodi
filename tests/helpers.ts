import { prisma } from "@/server/db";
import { createSession, cookieHeader, hashPassword } from "@/server/auth";
import { resetRateLimits } from "@/server/ratelimit";

const HOST = "localhost:3000";
let hashed: string | null = null;

export async function resetDb() {
  resetRateLimits();
  await prisma.session.deleteMany();
  await prisma.review.deleteMany();
  await prisma.watchlist.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.user.deleteMany();
}

export async function makeUser(email: string, role: "member" | "admin" = "member", name = "ผู้ใช้ทดสอบ") {
  hashed ??= await hashPassword("password123");
  const u = await prisma.user.create({ data: { email, displayName: name, passwordHash: hashed, role } });
  const token = await createSession(u.id);
  return { id: u.id, cookie: cookieHeader(token).split(";")[0] };
}

export const makeMovie = (title = "หนังทดสอบ", extra: Record<string, unknown> = {}) =>
  prisma.movie.create({ data: { title, releaseYear: 2024, genre: "ดราม่า,ตลก", ...extra } });

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface CallOpts {
  cookie?: string;
  body?: unknown;
  query?: Record<string, string | number>;
  headers?: Record<string, string>;
}

export async function call(handler: Handler, method: string, path: string, params: Record<string, string> = {}, opts: CallOpts = {}) {
  const url = new URL(`http://${HOST}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { host: HOST, ...opts.headers };
  if (opts.cookie) {
    headers.cookie = opts.cookie;
    headers.origin ??= `http://${HOST}`;
  }
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const req = new Request(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const res = await handler(req, { params: Promise.resolve(params) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text, json: text ? JSON.parse(text) : null };
}
