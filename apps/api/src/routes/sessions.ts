import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { eventBus } from "../lib/events.js";
import { providerRegistry } from "../lib/providers/registry.js";
import { config } from "../lib/config.js";

const createSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().max(200).optional(),
  selectedModel: z.string().max(100).optional(),
  selectedProvider: z.string().max(100).optional(),
});

const patchSchema = z.object({
  title: z.string().max(200).optional(),
  status: z.enum(["active", "paused", "completed", "failed", "cancelled"]).optional(),
  selectedModel: z.string().max(100).optional(),
  selectedProvider: z.string().max(100).optional(),
});

export async function sessionRoutes(app: FastifyInstance) {
  // POST /api/sessions
  app.post("/", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

    const userId = await getUserId(req);
    const { projectId, title, selectedModel, selectedProvider } = parsed.data;
    const providerId = selectedProvider || providerRegistry.defaultProviderId();
    if (!providerId) return reply.code(503).send({ error: "No production AI provider is configured" });

    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return reply.code(404).send({ error: "Project not found" });
      if (project.userId !== userId) return reply.code(403).send({ error: "Forbidden" });
    }

    const session = await prisma.session.create({
      data: {
        userId,
        projectId: projectId || null,
        title: title || "New Session",
        selectedModel: selectedModel || config.agent.defaultModel,
        selectedProvider: providerId,
        status: "active",
      },
    });

    await prisma.auditLog.create({ data: { userId, sessionId: session.id, action: "session.create", ipAddress: req.ip } });
    await eventBus.emitEvent(session.id, "session.created", { sessionId: session.id, title: session.title });

    return reply.code(201).send({ session });
  });

  // GET /api/sessions
  app.get("/", async (req) => {
    const userId = await getUserId(req);
    const sessions = await prisma.session.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
    return { sessions };
  });

  // GET /api/sessions/:sessionId
  app.get("/:sessionId", async (req, reply) => {
    const { sessionId } = req.params as any;
    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });
    return { session };
  });

  // PATCH /api/sessions/:sessionId
  app.patch("/:sessionId", async (req, reply) => {
    const { sessionId } = req.params as any;
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const data: any = { ...parsed.data };
    if (data.status === "completed") data.completedAt = new Date();

    const updated = await prisma.session.update({ where: { id: sessionId }, data });
    await prisma.auditLog.create({ data: { userId, sessionId, action: "session.update", ipAddress: req.ip } });
    return { session: updated };
  });

  // DELETE /api/sessions/:sessionId
  app.delete("/:sessionId", async (req, reply) => {
    const { sessionId } = req.params as any;
    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const activeRun = await prisma.agentRun.findFirst({
      where: { sessionId, status: { in: ["running", "waiting_approval"] } },
      select: { id: true },
    });
    if (activeRun) return reply.code(409).send({ error: "Stop the active run before deleting this session" });

    await prisma.session.delete({ where: { id: sessionId } });
    await prisma.auditLog.create({ data: { userId, sessionId, action: "session.delete", ipAddress: req.ip } });
    return { message: "Deleted" };
  });

  // POST /api/sessions/:sessionId/stop
  app.post("/:sessionId/stop", async (req, reply) => {
    const { sessionId } = req.params as any;
    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const updated = await prisma.session.update({ where: { id: sessionId }, data: { status: "cancelled", completedAt: new Date() } });
    // Cancel running agent runs
    await prisma.agentRun.updateMany({ where: { sessionId, status: "running" }, data: { status: "cancelled", completedAt: new Date() } });
    await eventBus.emitEvent(sessionId, "agent.failed", { reason: "Stopped by user" });
    return { session: updated };
  });
}
