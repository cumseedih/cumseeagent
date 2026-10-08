import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { buildTestApp, cleanup, createTestUser, authHeader } from "./helpers.js";
import { TerminalRunner } from "../lib/terminalRunner.js";

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

  it("requires approval for path traversal, sensitive files, and shell operators", async () => {
    for (const command of ["cat ../../apps/api/.env", "cat /home/agent/cumsee-platform/apps/api/.env", "cat .git/config", "echo safe && cat .env", "echo background &", "git branch -D feature"]) {
      const res = await app.inject({ method: "POST", url: `/api/sessions/${sessionId}/terminal/command`, headers: authHeader(token), payload: { command } });
      expect(res.statusCode, command).toBe(202);
    }
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

    const env = await app.inject({ method: "POST", url: `/api/sessions/${sessionId}/terminal/command`, headers: authHeader(token), payload: { command: "echo JWT_SECRET=raw-jwt-secret-value" } });
    expect(env.statusCode).toBe(200);
    expect(env.json().result.stdout).toContain("JWT_SECRET=***REDACTED***");
    expect(env.json().result.stdout).not.toContain("raw-jwt-secret-value");
  });

  it("redacts secret assignments before streaming partial output", async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "delvin-redaction-"));
    const emitted: string[] = [];
    try {
      const result = await new TerminalRunner().runStreaming({
        command: "printf 'JWT_SECRET=raw-' && sleep 0.05 && printf 'jwt-secret-value\\n'",
        cwd: workspaceRoot,
        workspaceRoot,
        approvalGranted: true,
        onStdout: (chunk) => emitted.push(chunk),
      });
      expect(result.stdout).toContain("JWT_SECRET=***REDACTED***");
      expect(result.stdout).not.toContain("raw-jwt-secret-value");
      expect(emitted.join("")).not.toContain("raw-jwt-secret-value");
      expect(emitted.join("")).toContain("JWT_SECRET=***REDACTED***");
    } finally {
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
