import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { eventBus } from "../lib/events.js";
import { agentEngine } from "../lib/agentEngine.js";

const toolCreateSchema = z.object({
  toolName: z.string().min(1),
  argumentsJson: z.any(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export async function toolCallRoutes(app: FastifyInstance) {
  // GET /api/sessions/:sessionId/tool-calls
  app.get("/sessions/:sessionId/tool-calls", async (req, reply) => {
    const { sessionId } = req.params as any;
    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const runs = await prisma.agentRun.findMany({ where: { sessionId }, select: { id: true } });
    const runIds = runs.map((r) => r.id);
    const toolCalls = await prisma.toolCall.findMany({ where: { agentRunId: { in: runIds } }, orderBy: { startedAt: "desc" }, take: 100 });
    return { toolCalls: toolCalls.map((t) => ({ ...t, argumentsJson: JSON.parse(t.argumentsJson) })) };
  });

  // GET /api/tool-calls/:toolCallId
  app.get("/tool-calls/:toolCallId", async (req, reply) => {
    const { toolCallId } = req.params as any;
    const userId = await getUserId(req);
    const tc = await prisma.toolCall.findUnique({ where: { id: toolCallId }, include: { agentRun: { include: { session: true } } } });
    if (!tc) return reply.code(404).send({ error: "Tool call not found" });
    if (tc.agentRun.session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });
    return { toolCall: { ...tc, argumentsJson: JSON.parse(tc.argumentsJson) } };
  });

  // POST /api/tool-calls/:toolCallId/approve
  app.post("/tool-calls/:toolCallId/approve", async (req, reply) => {
    const { toolCallId } = req.params as any;
    const userId = await getUserId(req);
    const tc = await prisma.toolCall.findUnique({ where: { id: toolCallId }, include: { agentRun: true } });
    if (!tc) return reply.code(404).send({ error: "Tool call not found" });
    const session = await prisma.session.findUnique({ where: { id: tc.agentRun.sessionId } });
    if (!session || session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const updated = await prisma.toolCall.update({ where: { id: toolCallId }, data: { approvalStatus: "approved", executionStatus: "running", startedAt: new Date() } });
    await prisma.approval.upsert({
      where: { toolCallId },
      create: { toolCallId, decision: "approved", resolvedBy: userId, resolvedAt: new Date() },
      update: { decision: "approved", resolvedBy: userId, resolvedAt: new Date() },
    });
    await eventBus.emitEvent(session.id, "tool.approved", { toolCallId, toolName: tc.toolName });
    await eventBus.emitEvent(session.id, "tool.started", { toolCallId, toolName: tc.toolName });
    await prisma.auditLog.create({ data: { userId, sessionId: session.id, action: "tool.approve", metadataJson: JSON.stringify({ toolCallId }), ipAddress: req.ip } });
    agentEngine.start(tc.agentRunId);
    return { toolCall: { ...updated, argumentsJson: JSON.parse(updated.argumentsJson) } };
  });

  // POST /api/tool-calls/:toolCallId/reject
  app.post("/tool-calls/:toolCallId/reject", async (req, reply) => {
    const { toolCallId } = req.params as any;
    const body = (req.body as any) || {};
    const reason = body.reason || null;
    const userId = await getUserId(req);
    const tc = await prisma.toolCall.findUnique({ where: { id: toolCallId }, include: { agentRun: true } });
    if (!tc) return reply.code(404).send({ error: "Tool call not found" });
    const session = await prisma.session.findUnique({ where: { id: tc.agentRun.sessionId } });
    if (!session || session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const rejection = { rejected: true, reason: reason || "Rejected by user" };
    const updated = await prisma.toolCall.update({ where: { id: toolCallId }, data: { approvalStatus: "rejected", executionStatus: "failed", resultJson: JSON.stringify(rejection), errorMessage: rejection.reason, completedAt: new Date() } });
    await prisma.approval.upsert({
      where: { toolCallId },
      create: { toolCallId, decision: "rejected", reason, resolvedBy: userId, resolvedAt: new Date() },
      update: { decision: "rejected", reason, resolvedBy: userId, resolvedAt: new Date() },
    });
    await eventBus.emitEvent(session.id, "tool.rejected", { toolCallId, toolName: tc.toolName, reason });
    await eventBus.emitEvent(session.id, "tool.failed", { toolCallId, toolName: tc.toolName, error: reason });
    await prisma.auditLog.create({ data: { userId, sessionId: session.id, action: "tool.reject", metadataJson: JSON.stringify({ toolCallId, reason }), ipAddress: req.ip } });
    await prisma.agentRun.update({ where: { id: tc.agentRunId }, data: { status: "running", currentStep: "model" } });
    agentEngine.start(tc.agentRunId);
    return { toolCall: { ...updated, argumentsJson: JSON.parse(updated.argumentsJson) } };
  });

  // Internal: create tool call (used by orchestrator) — POST /api/runs/:runId/tool-calls
  app.post("/runs/:runId/tool-calls", async (req, reply) => {
    const { runId } = req.params as any;
    const parsed = toolCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

    const userId = await getUserId(req);
    const run = await prisma.agentRun.findUnique({ where: { id: runId }, include: { session: true } });
    if (!run) return reply.code(404).send({ error: "Run not found" });
    if (run.session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const { toolName, argumentsJson, riskLevel } = parsed.data;
    const isHighRisk = ["high", "critical"].includes(riskLevel || "low");
    const tc = await prisma.toolCall.create({
      data: {
        agentRunId: runId,
        toolName,
        argumentsJson: JSON.stringify(argumentsJson),
        riskLevel: riskLevel || "low",
        approvalStatus: isHighRisk ? "pending" : "auto_approved",
        executionStatus: isHighRisk ? "pending" : "running",
        startedAt: isHighRisk ? null : new Date(),
      },
    });

    if (isHighRisk) {
      await prisma.approval.create({ data: { toolCallId: tc.id } });
      await eventBus.emitEvent(run.sessionId, "tool.approval_required", { toolCallId: tc.id, toolName, riskLevel });
    } else {
      await eventBus.emitEvent(run.sessionId, "tool.created", { toolCallId: tc.id, toolName });
      await eventBus.emitEvent(run.sessionId, "tool.started", { toolCallId: tc.id, toolName });
    }

    return reply.code(201).send({ toolCall: { ...tc, argumentsJson } });
  });
}
