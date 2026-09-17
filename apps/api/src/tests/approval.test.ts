import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildTestApp, cleanup, createTestUser, authHeader } from "./helpers.js";

describe("Tool Approval", () => {
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
    const s = await app.inject({ method: "POST", url: "/api/sessions", headers: authHeader(token), payload: { title: "Approval Test" } });
    sessionId = JSON.parse(s.body).session.id;
  });

  it("creates pending tool call for dangerous command and approves", async () => {
    const cmdRes = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/terminal/command`,
      headers: authHeader(token),
      payload: { command: "rm -rf /tmp/test-approval" },
    });
    expect(cmdRes.statusCode).toBe(202);
    const { toolCallId } = JSON.parse(cmdRes.body);

    // List tool calls
    const list = await app.inject({ method: "GET", url: `/api/sessions/${sessionId}/tool-calls`, headers: authHeader(token) });
    const calls = JSON.parse(list.body).toolCalls;
    expect(calls.some((c: any) => c.id === toolCallId)).toBe(true);

    // Approve
    const approve = await app.inject({ method: "POST", url: `/api/tool-calls/${toolCallId}/approve`, headers: authHeader(token) });
    expect(approve.statusCode).toBe(200);
    const approved = JSON.parse(approve.body).toolCall;
    expect(approved.approvalStatus).toBe("approved");

    // Check events include approved
    const events = await app.inject({ method: "GET", url: `/api/sessions/${sessionId}/events`, headers: authHeader(token) });
    const evs = JSON.parse(events.body).events;
    expect(evs.some((e: any) => e.eventType === "tool.approved")).toBe(true);
  });

  it("rejects tool call", async () => {
    const cmdRes = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/terminal/command`,
      headers: authHeader(token),
      payload: { command: "sudo apt-get update" },
    });
    const { toolCallId } = JSON.parse(cmdRes.body);

    const reject = await app.inject({
      method: "POST",
      url: `/api/tool-calls/${toolCallId}/reject`,
      headers: authHeader(token),
      payload: { reason: "Not needed" },
    });
    expect(reject.statusCode).toBe(200);
    const body = JSON.parse(reject.body);
    expect(body.toolCall.approvalStatus).toBe("rejected");
  });

  it("rejects invalid payload for auth", async () => {
    const res = await app.inject({ method: "POST", url: "/api/sessions/invalid/tool-calls", headers: authHeader(token) });
    // Should be 404 or 400, not 500
    expect([400, 404]).toContain(res.statusCode);
  });
});
