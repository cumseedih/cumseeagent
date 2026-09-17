import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { eventBus } from "../lib/events.js";

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
