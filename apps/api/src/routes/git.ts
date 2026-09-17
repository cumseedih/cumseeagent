import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { terminalRunner } from "../lib/terminalRunner.js";

export async function gitRoutes(app: FastifyInstance) {
  // GET /api/projects/:projectId/git/status
  app.get("/projects/:projectId/git/status", async (req, reply) => {
    const { projectId } = req.params as any;
    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    try {
      const result = await terminalRunner.run({ command: "git status --porcelain=v1 -b", cwd: project.workspacePath, workspaceRoot: project.workspacePath });
      return { status: result.stdout, branch: result.stdout.split("\n")[0] };
    } catch (e: any) {
      return reply.code(500).send({ error: e.message });
    }
  });

  // GET /api/projects/:projectId/git/diff
  app.get("/projects/:projectId/git/diff", async (req, reply) => {
    const { projectId } = req.params as any;
    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    try {
      const result = await terminalRunner.run({ command: "git diff --stat; echo '---'; git diff", cwd: project.workspacePath, workspaceRoot: project.workspacePath });
      return { diff: result.stdout };
    } catch (e: any) {
      return reply.code(500).send({ error: e.message });
    }
  });

  // POST /api/projects/:projectId/git/commit { message }
  app.post("/projects/:projectId/git/commit", async (req, reply) => {
    const { projectId } = req.params as any;
    const body = z.object({ message: z.string().min(1).max(500) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid payload", details: body.error.flatten() });

    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    try {
      // Safe: commit requires no approval? It's local but we allow auto for now
      const msg = body.data.message.replace(/"/g, '\\"');
      const result = await terminalRunner.run({ command: `git add -A && git commit -m "${msg}"`, cwd: project.workspacePath, workspaceRoot: project.workspacePath });
      await prisma.auditLog.create({ data: { userId, action: "git.commit", metadataJson: JSON.stringify({ projectId, message: body.data.message }), ipAddress: req.ip } });
      return { output: result.stdout + result.stderr, exitCode: result.exitCode };
    } catch (e: any) {
      return reply.code(500).send({ error: e.message });
    }
  });

  // POST /api/projects/:projectId/git/push — requires approval via policy (we simulate check)
  app.post("/projects/:projectId/git/push", async (req, reply) => {
    const { projectId } = req.params as any;
    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    // This is high-risk — in real flow, would create pending toolCall; here we block unless explicit approval flag
    const body = (req.body as any) || {};
    if (!body.approved) {
      return reply.code(202).send({ status: "approval_required", message: "git push requires approval. Send {approved: true} to confirm." });
    }

    try {
      const result = await terminalRunner.run({ command: "git push", cwd: project.workspacePath, workspaceRoot: project.workspacePath });
      await prisma.auditLog.create({ data: { userId, action: "git.push", metadataJson: JSON.stringify({ projectId }), ipAddress: req.ip } });
      return { output: result.stdout + result.stderr, exitCode: result.exitCode };
    } catch (e: any) {
      return reply.code(500).send({ error: e.message });
    }
  });

  // POST /api/projects/:projectId/git/pull
  app.post("/projects/:projectId/git/pull", async (req, reply) => {
    const { projectId } = req.params as any;
    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    try {
      const result = await terminalRunner.run({ command: "git pull --rebase || git pull", cwd: project.workspacePath, workspaceRoot: project.workspacePath });
      await prisma.auditLog.create({ data: { userId, action: "git.pull", metadataJson: JSON.stringify({ projectId }), ipAddress: req.ip } });
      return { output: result.stdout + result.stderr, exitCode: result.exitCode };
    } catch (e: any) {
      return reply.code(500).send({ error: e.message });
    }
  });
}
