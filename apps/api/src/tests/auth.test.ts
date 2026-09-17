import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildTestApp, cleanup } from "./helpers.js";

describe("Auth", () => {
  let app: any;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanup();
  });

  it("registers a new user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "alice@example.com", password: "secret123" },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.user.email).toBe("alice@example.com");
    expect(body.token).toBeDefined();
  });

  it("rejects duplicate email", async () => {
    await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "dup@example.com", password: "secret123" } });
    const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "dup@example.com", password: "secret123" } });
    expect(res.statusCode).toBe(409);
  });

  it("logs in with correct credentials", async () => {
    await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "bob@example.com", password: "secret123" } });
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "bob@example.com", password: "secret123" } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
  });

  it("rejects invalid credentials", async () => {
    await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "carol@example.com", password: "secret123" } });
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "carol@example.com", password: "wrong" } });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/auth/me with token", async () => {
    const reg = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "me@example.com", password: "secret123" } });
    const token = JSON.parse(reg.body).token;
    const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).user.email).toBe("me@example.com");
  });

  it("GET /api/auth/me without token returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("validates payload", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "not-an-email", password: "123" } });
    expect(res.statusCode).toBe(400);
  });
});
