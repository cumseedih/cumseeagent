import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { validateWorkspacePath } from "../lib/pathValidator.js";
import path from "path";
import fs from "fs/promises";
import { eventBus } from "../lib/events.js";

export async function fileRoutes(app: FastifyInstance) {
  // GET /api/projects/:projectId/files ?path=/
  app.get("/projects/:projectId/files", async (req, reply) => {
    const { projectId } = req.params as any;
    const query = req.query as any;
    const relPath = query.path || "/";
    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    try {
      const abs = validateWorkspacePath(project.workspacePath, relPath);
      const stat = await fs.stat(abs);
      if (stat.isDirectory()) {
        const entries = await fs.readdir(abs, { withFileTypes: true });
        const files = await Promise.all(
          entries.map(async (e) => {
            const full = path.join(abs, e.name);
            const s = await fs.stat(full);
            return {
              name: e.name,
              path: path.relative(project.workspacePath, full) || "/",
              isDirectory: e.isDirectory(),
              size: s.size,
              modifiedAt: s.mtime.toISOString(),
            };
          })
        );
        return { files, path: relPath };
      } else {
        return { files: [{ name: path.basename(abs), path: relPath, isDirectory: false, size: stat.size, modifiedAt: stat.mtime.toISOString() }], path: relPath };
      }
    } catch (e: any) {
      return reply.code(404).send({ error: e.message });
    }
  });

  // GET /api/projects/:projectId/files/content ?path=/src/index.ts
  app.get("/projects/:projectId/files/content", async (req, reply) => {
    const { projectId } = req.params as any;
    const query = req.query as any;
    const relPath = query.path;
    if (!relPath) return reply.code(400).send({ error: "path query required" });

    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const abs = validateWorkspacePath(project.workspacePath, relPath);
    // Size limit 1MB
    const stat = await fs.stat(abs);
    if (stat.size > 1_000_000) return reply.code(413).send({ error: "File too large" });

    const content = await fs.readFile(abs, "utf-8");
    return { path: relPath, content };
  });

  // POST /api/projects/:projectId/files { path, content }
  app.post("/projects/:projectId/files", async (req, reply) => {
    const { projectId } = req.params as any;
    const body = z.object({ path: z.string().min(1), content: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid payload", details: body.error.flatten() });

    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const { path: relPath, content } = body.data;
    if (content.length > 1_000_000) return reply.code(413).send({ error: "Content too large" });

    const abs = validateWorkspacePath(project.workspacePath, relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf-8");

    // Find latest agentRun for fileChanges
    const latestRun = await prisma.agentRun.findFirst({ where: { session: { projectId } }, orderBy: { startedAt: "desc" } });
    if (latestRun) {
      await prisma.fileChange.create({ data: { agentRunId: latestRun.id, path: relPath, changeType: "created", diff: content.slice(0, 5000) } });
      const sessionId = latestRun.sessionId;
      await eventBus.emitEvent(sessionId, "file.created", { path: relPath });
    }

    await prisma.auditLog.create({ data: { userId, action: "file.create", metadataJson: JSON.stringify({ projectId, path: relPath }), ipAddress: req.ip } });
    return reply.code(201).send({ path: relPath });
  });

  // PATCH /api/projects/:projectId/files { path, content }
  app.patch("/projects/:projectId/files", async (req, reply) => {
    const { projectId } = req.params as any;
    const body = z.object({ path: z.string().min(1), content: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid payload", details: body.error.flatten() });

    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const { path: relPath, content } = body.data;
    const abs = validateWorkspacePath(project.workspacePath, relPath);
    const before = await fs.readFile(abs, "utf-8").catch(() => "");
    await fs.writeFile(abs, content, "utf-8");

    // Simple diff
    const diff = `--- before\n+++ after\n${content.slice(0, 5000)}`;
    const latestRun = await prisma.agentRun.findFirst({ where: { session: { projectId } }, orderBy: { startedAt: "desc" } });
    if (latestRun) {
      await prisma.fileChange.create({ data: { agentRunId: latestRun.id, path: relPath, changeType: "modified", diff } });
      await eventBus.emitEvent(latestRun.sessionId, "file.modified", { path: relPath, diff });
    }

    await prisma.auditLog.create({ data: { userId, action: "file.update", metadataJson: JSON.stringify({ projectId, path: relPath }), ipAddress: req.ip } });
    return { path: relPath };
  });

  // DELETE /api/projects/:projectId/files ?path=/file
  app.delete("/projects/:projectId/files", async (req, reply) => {
    const { projectId } = req.params as any;
    const query = req.query as any;
    const relPath = query.path;
    if (!relPath) return reply.code(400).send({ error: "path query required" });

    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    // Require approval for delete: we enforce via audit + check
    // For now, allow but log as risky
    const abs = validateWorkspacePath(project.workspacePath, relPath);
    await fs.rm(abs, { recursive: true, force: true });

    const latestRun = await prisma.agentRun.findFirst({ where: { session: { projectId } }, orderBy: { startedAt: "desc" } });
    if (latestRun) {
      await prisma.fileChange.create({ data: { agentRunId: latestRun.id, path: relPath, changeType: "deleted" } });
      await eventBus.emitEvent(latestRun.sessionId, "file.deleted", { path: relPath });
    }

    await prisma.auditLog.create({ data: { userId, action: "file.delete", metadataJson: JSON.stringify({ projectId, path: relPath }), ipAddress: req.ip } });
    return { message: "Deleted" };
  });
}
