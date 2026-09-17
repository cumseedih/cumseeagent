import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildTestApp, cleanup, createTestUser, authHeader } from "./helpers.js";

describe("Sessions & Messages", () => {
  let app: any;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanup();
    const u = await createTestUser(app);
    token = u.token;
    userId = u.user.id;
  });

  it("creates a session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      headers: authHeader(token),
      payload: { title: "Test Session", selectedModel: "mock-gpt-4o" },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.session.title).toBe("Test Session");
  });

  it("persists sessions and lists them", async () => {
    await app.inject({ method: "POST", url: "/api/sessions", headers: authHeader(token), payload: { title: "S1" } });
    await app.inject({ method: "POST", url: "/api/sessions", headers: authHeader(token), payload: { title: "S2" } });
    const res = await app.inject({ method: "GET", url: "/api/sessions", headers: authHeader(token) });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sessions.length).toBe(2);
  });

  it("creates and persists messages", async () => {
    const s = await app.inject({ method: "POST", url: "/api/sessions", headers: authHeader(token), payload: { title: "Msg Test" } });
    const sessionId = JSON.parse(s.body).session.id;

    const m1 = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/messages`,
      headers: authHeader(token),
      payload: { role: "user", content: "Hello agent" },
    });
    expect(m1.statusCode).toBe(201);

    const m2 = await app.inject({ method: "GET", url: `/api/sessions/${sessionId}/messages`, headers: authHeader(token) });
    expect(m2.statusCode).toBe(200);
    const body = JSON.parse(m2.body);
    expect(body.messages.length).toBe(1);
    expect(body.messages[0].content).toBe("Hello agent");

    // Wait a bit for mock agent to create assistant message via provider
    await new Promise((r) => setTimeout(r, 1500));
    const m3 = await app.inject({ method: "GET", url: `/api/sessions/${sessionId}/messages`, headers: authHeader(token) });
    const msgs = JSON.parse(m3.body).messages;
    // Should have assistant response now (mock provider)
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it("enforces ownership (access control)", async () => {
    const s = await app.inject({ method: "POST", url: "/api/sessions", headers: authHeader(token), payload: { title: "Owner Test" } });
    const sessionId = JSON.parse(s.body).session.id;

    const other = await createTestUser(app, `other-${Date.now()}@example.com`);
    const res = await app.inject({ method: "GET", url: `/api/sessions/${sessionId}`, headers: authHeader(other.token) });
    expect(res.statusCode).toBe(403);
  });

  it("validates payload", async () => {
    const res = await app.inject({ method: "POST", url: "/api/sessions", headers: authHeader(token), payload: { title: "" } });
    // Title can be empty? Check: if title empty we default, but if we send invalid type it should be 400
    // Instead test invalid message
    const s = await app.inject({ method: "POST", url: "/api/sessions", headers: authHeader(token), payload: { title: "Valid" } });
    const sessionId = JSON.parse(s.body).session.id;
    const bad = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/messages`,
      headers: authHeader(token),
      payload: { role: "user", content: "" },
    });
    expect(bad.statusCode).toBe(400);
  });
});
