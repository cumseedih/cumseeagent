import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { terminalRunner } from "../lib/terminalRunner.js";
import { classifyRisk } from "../lib/approvalPolicy.js";
import { eventBus } from "../lib/events.js";
import { config } from "../lib/config.js";

export async function terminalRoutes(app: FastifyInstance) {
  // GET /api/sessions/:sessionId/terminal — list recent commands
  app.get("/sessions/:sessionId/terminal", async (req, reply) => {
    const { sessionId } = req.params as any;
    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const commands = await prisma.terminalCommand.findMany({
      where: { sessionId },
      orderBy: { startedAt: "desc" },
      take: 50,
    });
    return { commands };
  });

  // POST /api/sessions/:sessionId/terminal/command { command, cwd }
  app.post("/sessions/:sessionId/terminal/command", async (req, reply) => {
    const { sessionId } = req.params as any;
    const body = z.object({ command: z.string().min(1).max(5000), cwd: z.string().optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid payload", details: body.error.flatten() });

    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId, userId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });

    // Determine workspace
    let workspaceRoot = config.workspaceRoot;
    if (session.projectId) {
      const project = await prisma.project.findUnique({ where: { id: session.projectId } });
      if (project) workspaceRoot = project.workspacePath;
    }

    const { command, cwd } = body.data;

    // Classify
    const classification = classifyRisk(command);
    if (classification.requiresApproval) {
      // Create pending tool call that needs approval
      const latestRun = await prisma.agentRun.findFirst({ where: { sessionId }, orderBy: { startedAt: "desc" } });
      // If no run, create one
      let runId = latestRun?.id;
      if (!runId) {
        const run = await prisma.agentRun.create({ data: { sessionId, status: "running", goal: "Terminal command", currentStep: "terminal" } });
        runId = run.id;
      }
      const toolCall = await prisma.toolCall.create({
        data: {
          agentRunId: runId,
          toolName: "terminal",
          argumentsJson: JSON.stringify({ command, cwd }),
          riskLevel: classification.risk,
          approvalStatus: "pending",
          executionStatus: "pending",
        },
      });
      await prisma.approval.create({ data: { toolCallId: toolCall.id } });
      await prisma.terminalCommand.create({
        data: { toolCallId: toolCall.id, sessionId, commandDisplay: command, workingDirectory: cwd || workspaceRoot, stdout: "", stderr: "", exitCode: null },
      });
      await eventBus.emitEvent(sessionId, "tool.created", { toolCallId: toolCall.id, toolName: "terminal", command });
      await eventBus.emitEvent(sessionId, "tool.approval_required", { toolCallId: toolCall.id, command, riskLevel: classification.risk, reason: classification.reason });
      return reply.code(202).send({ status: "approval_required", toolCallId: toolCall.id, reason: classification.reason });
    }

    // Safe — execute immediately with streaming
    const terminalCmd = await prisma.terminalCommand.create({
      data: { sessionId, commandDisplay: command, workingDirectory: cwd || workspaceRoot, stdout: "", stderr: "", exitCode: null },
    });

    // Also create tool call for history
    const runForTerminal = await prisma.agentRun.findFirst({ where: { sessionId }, orderBy: { startedAt: "desc" } });
    let toolCallId: string | undefined;
    if (runForTerminal) {
      const tc = await prisma.toolCall.create({
        data: {
          agentRunId: runForTerminal.id,
          toolName: "terminal",
          argumentsJson: JSON.stringify({ command, cwd }),
          riskLevel: "low",
          approvalStatus: "auto_approved",
          executionStatus: "running",
          startedAt: new Date(),
        },
      });
      toolCallId = tc.id;
      await prisma.terminalCommand.update({ where: { id: terminalCmd.id }, data: { toolCallId } });
      await eventBus.emitEvent(sessionId, "tool.started", { toolCallId, command });
    }

    await eventBus.emitEvent(sessionId, "tool.started", { command, terminalCommandId: terminalCmd.id });

    // Stream execution
    try {
      const result = await terminalRunner.runStreaming({
        command,
        cwd: cwd || workspaceRoot,
        workspaceRoot,
        sessionId,
        onStdout: async (chunk) => {
          await eventBus.emitEvent(sessionId, "tool.stdout", { terminalCommandId: terminalCmd.id, toolCallId, chunk });
        },
        onStderr: async (chunk) => {
          await eventBus.emitEvent(sessionId, "tool.stderr", { terminalCommandId: terminalCmd.id, toolCallId, chunk });
        },
      });

      await prisma.terminalCommand.update({
        where: { id: terminalCmd.id },
        data: { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, completedAt: new Date() },
      });

      if (toolCallId) {
        await prisma.toolCall.update({
          where: { id: toolCallId },
          data: { executionStatus: result.exitCode === 0 ? "completed" : "failed", completedAt: new Date(), exitCode: result.exitCode, errorMessage: result.exitCode !== 0 ? result.stderr : null },
        });
        const eventType = result.exitCode === 0 ? "tool.completed" : "tool.failed";
        await eventBus.emitEvent(sessionId, eventType as any, { toolCallId, exitCode: result.exitCode });
      }

      await prisma.auditLog.create({ data: { userId, sessionId, action: "terminal.command", metadataJson: JSON.stringify({ command, exitCode: result.exitCode }), ipAddress: req.ip } });

      return { terminalCommand: { ...terminalCmd, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode }, result };
    } catch (e: any) {
      await prisma.terminalCommand.update({ where: { id: terminalCmd.id }, data: { stderr: e.message, exitCode: 1, completedAt: new Date() } });
      return reply.code(500).send({ error: e.message });
    }
  });

  // POST /api/terminal/:commandId/stop
  app.post("/terminal/:commandId/stop", async (req, reply) => {
    const { commandId } = req.params as any;
    const userId = await getUserId(req);
    const cmd = await prisma.terminalCommand.findUnique({ where: { id: commandId } });
    if (!cmd) return reply.code(404).send({ error: "Command not found" });

    // Ownership check via session or toolCall
    if (cmd.sessionId) {
      const session = await prisma.session.findUnique({ where: { id: cmd.sessionId } });
      if (!session || session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });
    }

    // In real runner we'd kill PID; here we just mark
    await prisma.terminalCommand.update({ where: { id: commandId }, data: { stderr: (cmd.stderr || "") + "\n[Stopped by user]", exitCode: 130, completedAt: new Date() } });
    if (cmd.toolCallId) {
      await prisma.toolCall.update({ where: { id: cmd.toolCallId }, data: { executionStatus: "failed", errorMessage: "Stopped by user", completedAt: new Date() } });
      const tc = await prisma.toolCall.findUnique({ where: { id: cmd.toolCallId } });
      if (tc) await eventBus.emitEvent(tc.agentRunId, "tool.failed", { toolCallId: tc.id, reason: "Stopped by user" });
    }

    return { message: "Stopped" };
  });
}
