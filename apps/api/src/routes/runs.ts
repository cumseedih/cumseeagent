import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { eventBus } from "../lib/events.js";
import { agentEngine } from "../lib/agentEngine.js";

export async function runRoutes(app: FastifyInstance) {
  // POST /api/sessions/:sessionId/runs
  app.post("/sessions/:sessionId/runs", async (req, reply) => {
    const { sessionId } = req.params as any;
    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const body = (req.body as any) || {};
    const goal = body.goal || "Agent task";

    const run = await prisma.agentRun.create({
      data: { sessionId, status: "running", goal, currentStep: "started" },
    });

    await eventBus.emitEvent(sessionId, "agent.started", { agentRunId: run.id, goal });
    return reply.code(201).send({ run });
  });

  // GET /api/sessions/:sessionId/runs
  app.get("/sessions/:sessionId/runs", async (req, reply) => {
    const { sessionId } = req.params as any;
    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const runs = await prisma.agentRun.findMany({ where: { sessionId }, orderBy: { startedAt: "desc" } });
    return { runs };
  });

  // GET /api/runs/:runId
  app.get("/runs/:runId", async (req, reply) => {
    const { runId } = req.params as any;
    const userId = await getUserId(req);
    const run = await prisma.agentRun.findUnique({ where: { id: runId }, include: { session: true } });
    if (!run) return reply.code(404).send({ error: "Run not found" });
    if (run.session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });
    return { run };
  });

  // POST /api/runs/:runId/retry — create a fresh run from a failed attempt.
  // A new row keeps the original failure/audit trail intact and avoids adding
  // the user's message to the conversation a second time.
  app.post("/runs/:runId/retry", async (req, reply) => {
    const { runId } = req.params as any;
    const userId = await getUserId(req);
    const failedRun = await prisma.agentRun.findUnique({
      where: { id: runId },
      include: { session: true, plans: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!failedRun) return reply.code(404).send({ error: "Run not found" });
    if (failedRun.session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });
    if (failedRun.status !== "failed") return reply.code(409).send({ error: "Only a failed run can be retried" });

    const activeRun = await prisma.agentRun.findFirst({
      where: { sessionId: failedRun.sessionId, status: { in: ["running", "waiting_approval"] } },
      select: { id: true },
    });
    if (activeRun) return reply.code(409).send({ error: "This session already has an active run" });

    const goal = failedRun.goal || "Retry agent task";
    const planJson = failedRun.plans[0]?.planJson || JSON.stringify({
      goal,
      steps: [
        { id: "1", title: "Analyze goal", status: "completed" },
        { id: "2", title: "Create execution plan", status: "pending" },
        { id: "3", title: "Execute tools", status: "pending" },
        { id: "4", title: "Verify and complete", status: "pending" },
      ],
    });

    const retriedRun = await prisma.$transaction(async (tx) => {
      const created = await tx.agentRun.create({
        data: { sessionId: failedRun.sessionId, status: "running", goal, currentStep: "analyzing" },
      });
      await tx.plan.create({ data: { agentRunId: created.id, planJson, status: "pending" } });
      await tx.session.update({
        where: { id: failedRun.sessionId },
        data: { status: "active", completedAt: null },
      });
      await tx.auditLog.create({
        data: {
          userId,
          sessionId: failedRun.sessionId,
          action: "agent.retry",
          metadataJson: JSON.stringify({ failedRunId: failedRun.id, retriedRunId: created.id }),
          ipAddress: req.ip,
        },
      });
      return created;
    });

    await eventBus.emitEvent(failedRun.sessionId, "agent.started", { agentRunId: retriedRun.id, goal, retryOf: failedRun.id });
    await eventBus.emitEvent(failedRun.sessionId, "agent.thinking", { agentRunId: retriedRun.id, step: "Retrying your request..." });
    await eventBus.emitEvent(failedRun.sessionId, "agent.plan.created", { agentRunId: retriedRun.id, plan: JSON.parse(planJson) });
    agentEngine.start(retriedRun.id);

    return reply.code(201).send({ run: retriedRun });
  });

  // POST /api/runs/:runId/pause
  app.post("/runs/:runId/pause", async (req, reply) => {
    const { runId } = req.params as any;
    const userId = await getUserId(req);
    const run = await prisma.agentRun.findUnique({ where: { id: runId }, include: { session: true } });
    if (!run) return reply.code(404).send({ error: "Run not found" });
    if (run.session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const updated = await prisma.agentRun.update({ where: { id: runId }, data: { status: "paused" } });
    await eventBus.emitEvent(run.sessionId, "agent.paused", { agentRunId: runId });
    return { run: updated };
  });

  // POST /api/runs/:runId/resume
  app.post("/runs/:runId/resume", async (req, reply) => {
    const { runId } = req.params as any;
    const userId = await getUserId(req);
    const run = await prisma.agentRun.findUnique({ where: { id: runId }, include: { session: true } });
    if (!run) return reply.code(404).send({ error: "Run not found" });
    if (run.session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const updated = await prisma.agentRun.update({ where: { id: runId }, data: { status: "running" } });
    await eventBus.emitEvent(run.sessionId, "agent.resumed", { agentRunId: runId });
    agentEngine.start(runId);
    return { run: updated };
  });

  // POST /api/runs/:runId/cancel
  app.post("/runs/:runId/cancel", async (req, reply) => {
    const { runId } = req.params as any;
    const userId = await getUserId(req);
    const run = await prisma.agentRun.findUnique({ where: { id: runId }, include: { session: true } });
    if (!run) return reply.code(404).send({ error: "Run not found" });
    if (run.session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const updated = await prisma.agentRun.update({ where: { id: runId }, data: { status: "cancelled", completedAt: new Date() } });
    await eventBus.emitEvent(run.sessionId, "agent.failed", { agentRunId: runId, reason: "Cancelled by user" });
    return { run: updated };
  });
}
