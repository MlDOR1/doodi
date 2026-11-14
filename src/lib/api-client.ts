import type { ApiErrorBody } from "./types";

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Browser-side JSON fetch for /api/v1. Throws ClientApiError with the server's Thai message. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ClientApiError(0, "network", "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
  }
  if (res.status === 204) return undefined as T;
  let json: (ApiErrorBody & { data?: T }) | { data: T; meta?: unknown } | null = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const err = (json as ApiErrorBody | null)?.error;
    throw new ClientApiError(res.status, err?.code ?? "error", err?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่", err?.fields);
  }
  return json as T;
}
