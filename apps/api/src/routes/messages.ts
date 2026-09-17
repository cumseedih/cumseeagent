import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { eventBus } from "../lib/events.js";
import { providerRegistry } from "../lib/providers/registry.js";

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

      // Simulate agent thinking + trigger provider (mock) streaming in background
      // For now, create an assistant message that will be streamed via SSE
      // We do not block the response — frontend will get events via SSE

      // Update session title if first message
      if (session.title === "New Session") {
        const title = content.slice(0, 60);
        await prisma.session.update({ where: { id: sessionId }, data: { title } });
      }

      // Kick off async agent completion (non-blocking)
      setImmediate(async () => {
        try {
          const providerId = selectedProvider || session.selectedProvider || "mock";
          const model = selectedModel || session.selectedModel || "mock-gpt-4o";
          const provider = providerRegistry.get(providerId) || providerRegistry.get("mock")!;
          const history = await prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" }, take: 20 });

          await eventBus.emitEvent(sessionId, "agent.thinking", { agentRunId: agentRun!.id, model, providerId });

          const stream = await provider.chat({
            model,
            messages: history.map((m) => ({ role: m.role as any, content: m.content })),
            stream: true,
          });

          let fullContent = "";
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
              fullContent += delta;
              // Emit thinking chunks
              await eventBus.emitEvent(sessionId, "agent.thinking", { agentRunId: agentRun!.id, delta });
            }
          }

          // Save final assistant message
          const assistantMsg = await prisma.message.create({
            data: { sessionId, role: "assistant", content: fullContent || "Task completed (mock).", status: "completed" },
          });

          // Update agent run
          await prisma.agentRun.update({
            where: { id: agentRun!.id },
            data: { status: "completed", completedAt: new Date(), currentStep: "completed" },
          });
          await prisma.plan.updateMany({ where: { agentRunId: agentRun!.id }, data: { status: "completed" } });

          await eventBus.emitEvent(sessionId, "agent.completed", { agentRunId: agentRun!.id, messageId: assistantMsg.id });
          await eventBus.emitEvent(sessionId, "notification.created", { title: "Task completed", body: fullContent.slice(0, 100) });

          // Mark session completed
          await prisma.session.update({ where: { id: sessionId }, data: { status: "completed", completedAt: new Date() } });
        } catch (e: any) {
          console.error("Agent run failed:", e);
          await prisma.agentRun.update({ where: { id: agentRun!.id }, data: { status: "failed", errorMessage: e.message, completedAt: new Date() } });
          await eventBus.emitEvent(sessionId, "agent.failed", { agentRunId: agentRun!.id, error: e.message });
        }
      });
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
