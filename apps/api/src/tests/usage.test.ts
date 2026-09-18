import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { cleanup } from "./helpers.js";

/**
 * Daily allowance + Terms of Use consent.
 * These back the pre-flight gate in the web workspace.
 */
describe("Usage & consent", () => {
  let app: any;
  let token: string;
  let sessionId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    await cleanup();

    const email = `usage-${Date.now()}@example.com`;
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password: "password123" },
    });
    token = reg.json().token;

    const project = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Usage Project", defaultBranch: "main" },
    });
    const session = await app.inject({
      method: "POST",
      url: "/api/sessions",
      headers: { authorization: `Bearer ${token}` },
      payload: { projectId: project.json().project.id, title: "Usage Session" },
    });
    sessionId = session.json().session.id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it("reports the daily allowance window", async () => {
    const res = await app.inject({ method: "GET", url: "/api/usage", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("used");
    expect(body).toHaveProperty("limit");
    expect(body).toHaveProperty("remaining");
    expect(body).toHaveProperty("exhausted");
    expect(new Date(body.windowStart).getUTCHours()).toBe(0);
    expect(new Date(body.resetsAt).getTime()).toBeGreaterThan(new Date(body.windowStart).getTime());
  });

  it("counts runs started today against the allowance", async () => {
    const before = (await app.inject({ method: "GET", url: "/api/usage", headers: { authorization: `Bearer ${token}` } })).json();

    await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/messages`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: "user", content: "First run of the day" },
    });

    const after = (await app.inject({ method: "GET", url: "/api/usage", headers: { authorization: `Bearer ${token}` } })).json();
    expect(after.used).toBe(before.used + 1);
    expect(after.remaining).toBe(before.remaining - 1);
  });

  it("blocks new runs once the allowance is exhausted", async () => {
    const limit = Number(process.env.DAILY_RUN_LIMIT || 40);
    // Fill the remaining allowance directly at the data layer
    const remaining = limit - (await app.inject({ method: "GET", url: "/api/usage", headers: { authorization: `Bearer ${token}` } })).json().used;
    for (let i = 0; i < remaining; i++) {
      await prisma.agentRun.create({
        data: { sessionId, status: "completed", goal: `filler ${i}`, completedAt: new Date() },
      });
    }

    const usage = (await app.inject({ method: "GET", url: "/api/usage", headers: { authorization: `Bearer ${token}` } })).json();
    expect(usage.exhausted).toBe(true);
    expect(usage.remaining).toBe(0);

    const res = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/messages`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: "user", content: "One more please" },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe("Out of credits for today");
    expect(res.json().code).toBe("quota_exhausted");
  });

  it("records and reports Terms of Use consent", async () => {
    const before = await app.inject({ method: "GET", url: "/api/auth/tou", headers: { authorization: `Bearer ${token}` } });
    expect(before.statusCode).toBe(200);
    expect(before.json().accepted).toBe(false);

    const accept = await app.inject({
      method: "PUT",
      url: "/api/auth/tou",
      headers: { authorization: `Bearer ${token}` },
      payload: { version: before.json().version },
    });
    expect(accept.statusCode).toBe(201);
    expect(accept.json().accepted).toBe(true);

    const after = await app.inject({ method: "GET", url: "/api/auth/tou", headers: { authorization: `Bearer ${token}` } });
    expect(after.json().accepted).toBe(true);
    expect(after.json().acceptedVersion).toBe(before.json().version);

    const logged = await prisma.auditLog.findFirst({ where: { action: "tou.accept" }, orderBy: { createdAt: "desc" } });
    expect(logged).not.toBeNull();
  });
});
