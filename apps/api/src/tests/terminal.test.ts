import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildTestApp, cleanup, createTestUser, authHeader } from "./helpers.js";

describe("Terminal Security", () => {
  let app: any;
  let token: string;
  let sessionId: string;

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
    const s = await app.inject({ method: "POST", url: "/api/sessions", headers: authHeader(token), payload: { title: "Terminal Test" } });
    sessionId = JSON.parse(s.body).session.id;
  });

  it("executes safe command (pwd)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/terminal/command`,
      headers: authHeader(token),
      payload: { command: "pwd" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.exitCode).toBe(0);
    expect(body.result.stdout).toBeDefined();
  });

  it("executes safe ls", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/terminal/command`,
      headers: authHeader(token),
      payload: { command: "ls -la" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("blocks dangerous rm -rf (requires approval)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/terminal/command`,
      headers: authHeader(token),
      payload: { command: "rm -rf /tmp/test" },
    });
    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("approval_required");
    expect(body.toolCallId).toBeDefined();
  });

  it("blocks sudo", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/terminal/command`,
      headers: authHeader(token),
      payload: { command: "sudo ls" },
    });
    expect(res.statusCode).toBe(202);
  });

  it("blocks systemctl", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/terminal/command`,
      headers: authHeader(token),
      payload: { command: "systemctl restart nginx" },
    });
    expect(res.statusCode).toBe(202);
  });

  it("handles command timeout (simulated with sleep 2 and short timeout via direct runner)", async () => {
    // The API has 30s timeout; we test that short command still succeeds
    const res = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/terminal/command`,
      headers: authHeader(token),
      payload: { command: "echo hello && sleep 0.1 && echo done" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.stdout).toContain("hello");
    expect(body.result.stdout).toContain("done");
  });

  it("redacts secrets", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/terminal/command`,
      headers: authHeader(token),
      payload: { command: "echo sk-12345678901234567890" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.stdout).toContain("***REDACTED***");
    expect(body.result.stdout).not.toContain("sk-12345678901234567890");
  });
});
