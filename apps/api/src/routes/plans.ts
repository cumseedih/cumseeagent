import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { eventBus } from "../lib/events.js";

export async function planRoutes(app: FastifyInstance) {
  // GET /api/runs/:runId/plan
  app.get("/runs/:runId/plan", async (req, reply) => {
    const { runId } = req.params as any;
    const userId = await getUserId(req);
    const run = await prisma.agentRun.findUnique({ where: { id: runId }, include: { session: true } });
    if (!run) return reply.code(404).send({ error: "Run not found" });
    if (run.session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const plan = await prisma.plan.findFirst({ where: { agentRunId: runId }, orderBy: { createdAt: "desc" } });
    if (!plan) return reply.code(404).send({ error: "Plan not found" });
    return { plan: { ...plan, planJson: JSON.parse(plan.planJson) } };
  });

  // POST /api/runs/:runId/plan/approve
  app.post("/runs/:runId/plan/approve", async (req, reply) => {
    const { runId } = req.params as any;
    const userId = await getUserId(req);
    const run = await prisma.agentRun.findUnique({ where: { id: runId }, include: { session: true } });
    if (!run) return reply.code(404).send({ error: "Run not found" });
    if (run.session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const plan = await prisma.plan.findFirst({ where: { agentRunId: runId }, orderBy: { createdAt: "desc" } });
    if (!plan) return reply.code(404).send({ error: "Plan not found" });

    const updated = await prisma.plan.update({ where: { id: plan.id }, data: { status: "approved" } });
    await eventBus.emitEvent(run.sessionId, "agent.plan.updated", { agentRunId: runId, planId: plan.id, status: "approved" });
    await prisma.auditLog.create({ data: { userId, sessionId: run.sessionId, action: "plan.approve", ipAddress: req.ip } });
    return { plan: { ...updated, planJson: JSON.parse(updated.planJson) } };
  });

  // POST /api/runs/:runId/plan/reject
  app.post("/runs/:runId/plan/reject", async (req, reply) => {
    const { runId } = req.params as any;
    const userId = await getUserId(req);
    const run = await prisma.agentRun.findUnique({ where: { id: runId }, include: { session: true } });
    if (!run) return reply.code(404).send({ error: "Run not found" });
    if (run.session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const plan = await prisma.plan.findFirst({ where: { agentRunId: runId }, orderBy: { createdAt: "desc" } });
    if (!plan) return reply.code(404).send({ error: "Plan not found" });

    const updated = await prisma.plan.update({ where: { id: plan.id }, data: { status: "rejected" } });
    await prisma.agentRun.update({ where: { id: runId }, data: { status: "failed", errorMessage: "Plan rejected by user" } });
    await eventBus.emitEvent(run.sessionId, "agent.plan.updated", { agentRunId: runId, planId: plan.id, status: "rejected" });
    await eventBus.emitEvent(run.sessionId, "agent.failed", { agentRunId: runId, reason: "Plan rejected" });
    await prisma.auditLog.create({ data: { userId, sessionId: run.sessionId, action: "plan.reject", ipAddress: req.ip } });
    return { plan: { ...updated, planJson: JSON.parse(updated.planJson) } };
  });
}
