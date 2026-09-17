import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { config } from "../lib/config.js";
import path from "path";
import fs from "fs/promises";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  repositoryUrl: z.string().url().optional().or(z.literal("")),
  defaultBranch: z.string().max(100).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  repositoryUrl: z.string().url().optional().or(z.literal("")).optional(),
  defaultBranch: z.string().max(100).optional(),
});

export async function projectRoutes(app: FastifyInstance) {
  // POST /api/projects
  app.post("/", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

    const userId = await getUserId(req);
    const { name, repositoryUrl, defaultBranch } = parsed.data;

    // Create project, then set workspacePath based on id
    const tmp = await prisma.project.create({
      data: {
        userId,
        name,
        repositoryUrl: repositoryUrl || null,
        defaultBranch: defaultBranch || "main",
        workspacePath: `tmp-${Date.now()}`, // placeholder
      },
    });

    const workspacePath = path.join(config.workspaceRoot, tmp.id);
    await fs.mkdir(workspacePath, { recursive: true });

    const project = await prisma.project.update({
      where: { id: tmp.id },
      data: { workspacePath },
    });

    await prisma.auditLog.create({
      data: { userId, action: "project.create", metadataJson: JSON.stringify({ projectId: project.id, name }), ipAddress: req.ip },
    });

    return reply.code(201).send({ project });
  });

  // GET /api/projects
  app.get("/", async (req) => {
    const userId = await getUserId(req);
    const projects = await prisma.project.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return { projects };
  });

  // GET /api/projects/:projectId
  app.get("/:projectId", async (req, reply) => {
    const { projectId } = req.params as any;
    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });
    return { project };
  });

  // PATCH /api/projects/:projectId
  app.patch("/:projectId", async (req, reply) => {
    const { projectId } = req.params as any;
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const updated = await prisma.project.update({ where: { id: projectId }, data: parsed.data });
    await prisma.auditLog.create({ data: { userId, action: "project.update", metadataJson: JSON.stringify({ projectId }), ipAddress: req.ip } });
    return { project: updated };
  });

  // DELETE /api/projects/:projectId
  app.delete("/:projectId", async (req, reply) => {
    const { projectId } = req.params as any;
    const userId = await getUserId(req);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    await prisma.project.delete({ where: { id: projectId } });
    // Optionally keep workspace for safety; don't delete files destructively
    await prisma.auditLog.create({ data: { userId, action: "project.delete", metadataJson: JSON.stringify({ projectId }), ipAddress: req.ip } });
    return { message: "Deleted" };
  });
}
