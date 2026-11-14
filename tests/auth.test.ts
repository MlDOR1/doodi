import { beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import { GET as me } from "@/app/api/v1/auth/me/route";
import { prisma } from "@/server/db";
import { call, resetDb } from "./helpers";

const valid = {
  display_name: "สมชาย",
  email: "Somchai@Example.com",
  password: "password123",
  password_confirmation: "password123",
};

beforeEach(resetDb);

describe("auth", () => {
  it("registers a member, hashes the password, and sets an HttpOnly session cookie", async () => {
    const res = await call(register, "POST", "/api/v1/auth/register", {}, { body: valid });
    expect(res.status).toBe(201);
    expect(res.json.data).toMatchObject({ email: "somchai@example.com", role: "member", display_name: "สมชาย" });
    expect(res.text).not.toContain("password");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const row = await prisma.user.findUniqueOrThrow({ where: { email: "somchai@example.com" } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.passwordHash).not.toContain("password123");

    const who = await call(me, "GET", "/api/v1/auth/me", {}, { cookie: cookie.split(";")[0] });
    expect(who.status).toBe(200);
    expect(who.json.data.user_id).toBe(row.id);
  });

  it("never lets public registration choose the admin role", async () => {
    const res = await call(register, "POST", "/api/v1/auth/register", {}, { body: { ...valid, role: "admin" } });
    expect(res.status).toBe(201);
    expect(res.json.data.role).toBe("member");
    expect((await prisma.user.findFirstOrThrow()).role).toBe("member");
  });

  it("rejects bad input with Thai field errors and a duplicate email with 409", async () => {
    const bad = await call(register, "POST", "/api/v1/auth/register", {}, {
      body: { display_name: "ก", email: "nope", password: "short", password_confirmation: "different" },
    });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.json.error.fields).sort()).toEqual(["display_name", "email", "password", "password_confirmation"]);

    await call(register, "POST", "/api/v1/auth/register", {}, { body: valid });
    const dup = await call(register, "POST", "/api/v1/auth/register", {}, { body: { ...valid, email: "SOMCHAI@example.com" } });
    expect(dup.status).toBe(409);
    expect(dup.json.error.code).toBe("email_taken");
  });

  it("logs in with correct credentials only, with a generic error otherwise", async () => {
    await call(register, "POST", "/api/v1/auth/register", {}, { body: valid });
    const ok = await call(login, "POST", "/api/v1/auth/login", {}, { body: { email: "somchai@example.com", password: "password123" } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/doodi_session=/);

    const wrongPw = await call(login, "POST", "/api/v1/auth/login", {}, { body: { email: "somchai@example.com", password: "nope-nope" } });
    const noUser = await call(login, "POST", "/api/v1/auth/login", {}, { body: { email: "ghost@example.com", password: "password123" } });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.json.error.message).toBe(noUser.json.error.message);
  });

  it("rate-limits repeated failed logins with 429 and Retry-After", async () => {
    let last = { status: 0, headers: new Headers() };
    for (let i = 0; i < 9; i++) {
      last = await call(login, "POST", "/api/v1/auth/login", {}, { body: { email: "victim@example.com", password: "wrong-wrong" } });
    }
    expect(last.status).toBe(429);
    expect(Number(last.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("returns 401 from /me when unauthenticated, and logout ends the session with 204 and no body", async () => {
    expect((await call(me, "GET", "/api/v1/auth/me")).status).toBe(401);

    const reg = await call(register, "POST", "/api/v1/auth/register", {}, { body: valid });
    const cookie = reg.headers.get("set-cookie")!.split(";")[0];
    const out = await call(logout, "POST", "/api/v1/auth/logout", {}, { cookie });
    expect(out.status).toBe(204);
    expect(out.text).toBe("");
    expect(out.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect((await call(me, "GET", "/api/v1/auth/me", {}, { cookie })).status).toBe(401);
    expect(await prisma.session.count()).toBe(0);
  });

  it("rejects cookie-authenticated mutations from a foreign origin (CSRF)", async () => {
    const reg = await call(register, "POST", "/api/v1/auth/register", {}, { body: valid });
    const cookie = reg.headers.get("set-cookie")!.split(";")[0];
    const evil = await call(logout, "POST", "/api/v1/auth/logout", {}, { cookie, headers: { origin: "https://evil.example" } });
    expect(evil.status).toBe(403);
    expect(evil.json.error.code).toBe("csrf_rejected");
    expect(await prisma.session.count()).toBe(1);
  });
});
