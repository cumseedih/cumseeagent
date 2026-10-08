import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getOrCreateDefaultAgent } from "../lib/agentProfiles.js";
import { getUserId } from "./auth.js";
import { eventBus } from "../lib/events.js";
import { providerRegistry } from "../lib/providers/registry.js";
import { config } from "../lib/config.js";

const createSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().max(200).optional(),
  selectedModel: z.string().max(100).optional(),
  selectedProvider: z.string().max(100).optional(),
  agentProfileId: z.string().optional(),
  groupChatId: z.string().optional(),
}).refine((data) => !(data.agentProfileId && data.groupChatId), "Choose an Agent or a Group Chat, not both");

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["active", "paused", "completed", "failed", "cancelled"]).optional(),
  selectedModel: z.string().max(100).optional(),
  selectedProvider: z.string().max(100).optional(),
  isPinned: z.boolean().optional(),
});

const sessionSummary = {
  agentProfile: { select: { id: true, name: true, avatarUrl: true, isDefault: true, isPinned: true } },
  groupChat: { select: { id: true, name: true, isPinned: true } },
};

export async function sessionRoutes(app: FastifyInstance) {
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

    let agentProfileId = parsed.data.agentProfileId || null;
    const groupChatId = parsed.data.groupChatId || null;
    if (groupChatId) {
      const group = await prisma.groupChat.findUnique({ where: { id: groupChatId } });
      if (!group) return reply.code(404).send({ error: "Group Chat not found" });
      if (group.userId !== userId) return reply.code(403).send({ error: "Forbidden" });
      const memberCount = await prisma.groupChatMember.count({ where: { groupChatId } });
      if (memberCount < 1) return reply.code(409).send({ error: "A Group Chat must contain at least one Agent" });
      agentProfileId = null;
    } else if (agentProfileId) {
      const agent = await prisma.agentProfile.findUnique({ where: { id: agentProfileId } });
      if (!agent) return reply.code(404).send({ error: "Agent not found" });
      if (agent.userId !== userId) return reply.code(403).send({ error: "Forbidden" });
    } else {
      agentProfileId = (await getOrCreateDefaultAgent(userId)).id;
    }

    const session = await prisma.session.create({
      data: {
        userId,
        projectId: projectId || null,
        title: title || "New Session",
        selectedModel: selectedModel || config.agent.defaultModel,
        selectedProvider: providerId,
        agentProfileId,
        groupChatId,
        status: "active",
      },
      include: sessionSummary,
    });

    await prisma.auditLog.create({ data: { userId, sessionId: session.id, action: "session.create", ipAddress: req.ip } });
    await eventBus.emitEvent(session.id, "session.created", { sessionId: session.id, title: session.title });
    return reply.code(201).send({ session });
  });

  app.get("/", async (req) => {
    const userId = await getUserId(req);
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      take: 100,
      include: sessionSummary,
    });
    return { sessions };
  });

  app.get("/:sessionId", async (req, reply) => {
    const { sessionId } = req.params as any;
    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId }, include: sessionSummary });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });
    return { session };
  });

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
    const updated = await prisma.session.update({ where: { id: sessionId }, data, include: sessionSummary });
    await prisma.auditLog.create({ data: { userId, sessionId, action: "session.update", ipAddress: req.ip } });
    return { session: updated };
  });

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

  app.post("/:sessionId/stop", async (req, reply) => {
    const { sessionId } = req.params as any;
    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const updated = await prisma.session.update({ where: { id: sessionId }, data: { status: "cancelled", completedAt: new Date() } });
    await prisma.agentRun.updateMany({ where: { sessionId, status: "running" }, data: { status: "cancelled", completedAt: new Date() } });
    await eventBus.emitEvent(sessionId, "agent.failed", { reason: "Stopped by user" });
    return { session: updated };
  });
}
