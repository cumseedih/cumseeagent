import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, buildTestApp, cleanup, createTestUser } from "./helpers.js";
import { prisma } from "../lib/prisma.js";
import { agentEngine } from "../lib/agentEngine.js";

describe("Agent library", () => {
  let app: any;
  let token: string;
  let userId: string;
  const fixtureRoots: string[] = [];

  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => {
    await cleanup();
    const user = await createTestUser(app);
    token = user.token;
    userId = user.user.id;
  });
  afterEach(async () => { await Promise.all(fixtureRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

  it("creates, lists, and toggles instruction-only Skills", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/skills",
      headers: authHeader(token),
      payload: { name: "TypeScript review", description: "Review conventions", instructions: "Check types and tests before suggesting changes." },
    });
    expect(created.statusCode).toBe(201);
    const skill = JSON.parse(created.body).skill;
    expect(skill.instructions).toContain("Check types");
    expect(skill.enabled).toBe(true);
    expect(skill.definitionJson).toBeUndefined();

    const disabled = await app.inject({ method: "PATCH", url: `/api/skills/${skill.id}`, headers: authHeader(token), payload: { enabled: false } });
    expect(disabled.statusCode).toBe(200);
    expect(JSON.parse(disabled.body).skill.enabled).toBe(false);

    const listed = await app.inject({ method: "GET", url: "/api/skills", headers: authHeader(token) });
    expect(JSON.parse(listed.body).skills).toHaveLength(1);
  });

  it("keeps Skills private to their owner", async () => {
    const created = await app.inject({ method: "POST", url: "/api/skills", headers: authHeader(token), payload: { name: "Private skill", instructions: "Only my account should see this." } });
    const skillId = JSON.parse(created.body).skill.id;
    const other = await createTestUser(app, `other-${Date.now()}@example.com`);
    const update = await app.inject({ method: "PATCH", url: `/api/skills/${skillId}`, headers: authHeader(other.token), payload: { enabled: false } });
    expect(update.statusCode).toBe(404);
    const list = await app.inject({ method: "GET", url: "/api/skills", headers: authHeader(other.token) });
    expect(JSON.parse(list.body).skills).toHaveLength(0);
  });

  it("creates reusable manual workflows and supports enable/disable", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/workflows",
      headers: authHeader(token),
      payload: { name: "Release check", description: "Run the release checklist", prompt: "Inspect the project, run its test suite, and summarize release readiness." },
    });
    expect(created.statusCode).toBe(201);
    const workflow = JSON.parse(created.body).workflow;
    expect(workflow.triggerType).toBe("manual");
    expect(workflow.enabled).toBe(true);

    const disabled = await app.inject({ method: "PATCH", url: `/api/workflows/${workflow.id}`, headers: authHeader(token), payload: { enabled: false } });
    expect(disabled.statusCode).toBe(200);
    expect(JSON.parse(disabled.body).workflow.enabled).toBe(false);

    const run = await app.inject({ method: "POST", url: `/api/workflows/${workflow.id}/run`, headers: authHeader(token) });
    expect(run.statusCode).toBe(409);
    expect(JSON.parse(run.body).error).toMatch(/Enable/);
  });

  it("starts a saved workflow as a fresh, linked agent session", async () => {
    const created = await app.inject({ method: "POST", url: "/api/workflows", headers: authHeader(token), payload: { name: "Fresh check", prompt: "Run the project checks and report any failures." } });
    const workflowId = JSON.parse(created.body).workflow.id;
    const start = vi.spyOn(agentEngine, "start").mockImplementation(() => undefined);
    try {
      const response = await app.inject({ method: "POST", url: `/api/workflows/${workflowId}/run`, headers: authHeader(token) });
      expect(response.statusCode).toBe(201);
      const result = JSON.parse(response.body);
      expect(result.session.title).toBe("Fresh check");
      expect(result.message.content).toBe("Run the project checks and report any failures.");
      expect(result.workflowRun.agentRunId).toBe(result.agentRun.id);
      expect(start).toHaveBeenCalledWith(result.agentRun.id);
    } finally { start.mockRestore(); }
  });

  it("previews owner artifacts but rejects symlink escapes", async () => {
    const projectRes = await app.inject({ method: "POST", url: "/api/projects", headers: authHeader(token), payload: { name: "Artifact fixture" } });
    expect(projectRes.statusCode).toBe(201);
    const project = JSON.parse(projectRes.body).project;
    fixtureRoots.push(project.workspacePath);
    await fs.writeFile(path.join(project.workspacePath, "report.md"), "Report content");
    await fs.symlink("/etc/passwd", path.join(project.workspacePath, "escaped.txt"));

    const artifact = await (prisma as any).artifact.create({ data: { userId, projectId: project.id, name: "report.md", kind: "document", mimeType: "text/markdown", workspacePath: "report.md", sizeBytes: 14 } });
    const preview = await app.inject({ method: "GET", url: `/api/artifacts/${artifact.id}/content`, headers: authHeader(token) });
    expect(preview.statusCode).toBe(200);
    expect(JSON.parse(preview.body).content).toBe("Report content");

    const escaped = await (prisma as any).artifact.create({ data: { userId, projectId: project.id, name: "escaped.txt", kind: "document", workspacePath: "escaped.txt" } });
    const denied = await app.inject({ method: "GET", url: `/api/artifacts/${escaped.id}/content`, headers: authHeader(token) });
    expect(denied.statusCode).toBe(403);
  });

  it("rejects malformed Skill and Workflow content", async () => {
    const skill = await app.inject({ method: "POST", url: "/api/skills", headers: authHeader(token), payload: { name: "x", instructions: "" } });
    expect(skill.statusCode).toBe(400);
    const workflow = await app.inject({ method: "POST", url: "/api/workflows", headers: authHeader(token), payload: { name: "x", prompt: "" } });
    expect(workflow.statusCode).toBe(400);
  });
});
