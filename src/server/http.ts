import { ZodError, type ZodType } from "zod";
import { Prisma } from "@/generated/prisma/client";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
export const isForeignKeyViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003";

export const ok = (data: unknown, headers?: HeadersInit) => Response.json({ data }, { headers });
export const created = (data: unknown, headers?: HeadersInit) => Response.json({ data }, { status: 201, headers });
export const paged = (data: unknown, meta: object) => Response.json({ data, meta });
export const noContent = (headers?: HeadersInit) => new Response(null, { status: 204, headers });

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) {
    return Response.json(
      { error: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) } },
      { status: e.status, headers: e.headers },
    );
  }
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of e.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    return Response.json(
      { error: { code: "validation_error", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง", fields } },
      { status: 400 },
    );
  }
  if (isUniqueViolation(e)) {
    return Response.json({ error: { code: "conflict", message: "ข้อมูลนี้มีอยู่แล้ว" } }, { status: 409 });
  }
  console.error("[api] unhandled error", e);
  return Response.json({ error: { code: "internal_error", message: "เกิดข้อผิดพลาดภายในระบบ" } }, { status: 500 });
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-authenticated mutations (on top of SameSite=Lax):
 * a browser always sends Origin on cross-site writes, so it must match this host.
 * Requests with no Origin at all (curl, server-to-server) are only accepted without cookies.
 */
export function assertSameOrigin(req: Request) {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get("origin");
  let allowed: boolean;
  if (origin) {
    try {
      const host = new URL(origin).host;
      const configured = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).host : null;
      allowed = host === req.headers.get("host") || host === configured;
    } catch {
      allowed = false;
    }
  } else {
    allowed = !req.headers.get("cookie");
  }
  if (!allowed) throw new ApiError(403, "csrf_rejected", "คำขอถูกปฏิเสธเพราะมาจากต้นทางที่ไม่ได้รับอนุญาต");
}

type Ctx = { params: Promise<Record<string, string>> };

export function route(fn: (req: Request, params: Record<string, string>) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      assertSameOrigin(req);
      return await fn(req, await ctx.params);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "รูปแบบ JSON ไม่ถูกต้อง");
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const obj: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams) if (v !== "") obj[k] = v;
  return schema.parse(obj);
}

export function idParam(params: Record<string, string>, key = "id"): number {
  const v = params[key];
  const n = Number(v);
  if (!/^\d+$/.test(v ?? "") || !Number.isSafeInteger(n) || n < 1 || n > 2147483647) {
    throw new ApiError(400, "invalid_id", "รหัสไม่ถูกต้อง");
  }
  return n;
}

export const pageMeta = (page: number, pageSize: number, total: number) => ({
  page,
  page_size: pageSize,
  total,
  total_pages: Math.max(1, Math.ceil(total / pageSize)),
});
