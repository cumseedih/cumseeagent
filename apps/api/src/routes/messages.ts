import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { eventBus } from "../lib/events.js";
import { agentEngine } from "../lib/agentEngine.js";

const createSchema = z.object({
  role: z.enum(["user", "assistant", "system"]).default("user"),
  content: z.string().min(1).max(50000),
  // Optional: if client wants to trigger agent immediately
  selectedModel: z.string().optional(),
  selectedProvider: z.string().optional(),
});

export async function messageRoutes(app: FastifyInstance) {
  // POST /api/sessions/:sessionId/messages
  app.post("/:sessionId/messages", async (req, reply) => {
    const { sessionId } = req.params as any;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const { role, content, selectedModel, selectedProvider } = parsed.data;

    const message = await prisma.message.create({
      data: { sessionId, role, content, status: "completed" },
    });

    // Also create an agent run if user message — start orchestration
    let agentRun = null;
    if (role === "user") {
      agentRun = await prisma.agentRun.create({
        data: {
          sessionId,
          status: "running",
          goal: content.slice(0, 500),
          currentStep: "analyzing",
        },
      });

      // Create a plan
      const planJson = JSON.stringify({
        steps: [
          { id: "1", title: "Analyze goal", status: "completed" },
          { id: "2", title: "Create execution plan", status: "pending" },
          { id: "3", title: "Execute tools", status: "pending" },
          { id: "4", title: "Verify and complete", status: "pending" },
        ],
        goal: content,
      });
      await prisma.plan.create({ data: { agentRunId: agentRun.id, planJson, status: "pending" } });

      await eventBus.emitEvent(sessionId, "agent.started", { agentRunId: agentRun.id, goal: content });
      await eventBus.emitEvent(sessionId, "agent.thinking", { agentRunId: agentRun.id, step: "Analyzing your request..." });
      await eventBus.emitEvent(sessionId, "agent.plan.created", { agentRunId: agentRun.id, plan: JSON.parse(planJson) });

      // Update session title if first message
      if (session.title === "New Session") {
        const title = content.slice(0, 60);
        await prisma.session.update({ where: { id: sessionId }, data: { title, selectedModel, selectedProvider, status: "active", completedAt: null } });
      } else if (selectedModel || selectedProvider) {
        await prisma.session.update({ where: { id: sessionId }, data: { selectedModel, selectedProvider, status: "active", completedAt: null } });
      }
      agentEngine.start(agentRun.id);
    }

    await prisma.auditLog.create({ data: { userId, sessionId, action: "message.create", ipAddress: req.ip } });

    return reply.code(201).send({ message, agentRun });
  });

  // GET /api/sessions/:sessionId/messages
  app.get("/:sessionId/messages", async (req, reply) => {
    const { sessionId } = req.params as any;
    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const messages = await prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
    return { messages };
  });
}
