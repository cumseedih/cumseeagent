import fs from "fs/promises";
import path from "path";
import { prisma } from "./prisma.js";
import { eventBus } from "./events.js";
import { providerRegistry } from "./providers/registry.js";
import type { ChatMessage, CollectedToolCall } from "./providers/types.js";
import { terminalRunner } from "./terminalRunner.js";
import { classifyRisk } from "./approvalPolicy.js";
import { validateWorkspacePath } from "./pathValidator.js";
import { config } from "./config.js";

const MAX_ITERATIONS = Number(process.env.AGENT_MAX_ITERATIONS || 20);
const MAX_FILE_BYTES = 1_000_000;
type Effort = "quick" | "standard" | "deep";

function requestedEffort(messages: Array<{ role: string; metadataJson?: string | null }>): Effort {
  const latest = [...messages].reverse().find((message) => message.role === "user" && message.metadataJson);
  if (!latest?.metadataJson) return "standard";
  try {
    const effort = JSON.parse(latest.metadataJson)?.effort;
    return effort === "quick" || effort === "deep" ? effort : "standard";
  } catch {
    return "standard";
  }
}

const tools = [
  { type: "function", function: { name: "terminal", description: "Run a shell command in the project workspace.", parameters: { type: "object", properties: { command: { type: "string" }, cwd: { type: "string" } }, required: ["command"], additionalProperties: false } } },
  { type: "function", function: { name: "read_file", description: "Read a UTF-8 file from the workspace.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false } } },
  { type: "function", function: { name: "write_file", description: "Create or replace a UTF-8 file in the workspace.", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"], additionalProperties: false } } },
  { type: "function", function: { name: "list_files", description: "List a workspace directory.", parameters: { type: "object", properties: { path: { type: "string" } }, additionalProperties: false } } },
];

const systemPrompt = `You are a coding agent operating inside one project workspace.
Use tools to inspect and change the project. Never claim a command ran or a file changed unless a tool result confirms it.
Prefer small, verifiable changes. Run relevant tests after edits. Do not access paths outside the workspace.
When the task is complete, respond with a concise summary and verification results.`;

type Accumulator = { id: string; name: string; arguments: string };

class AgentEngine {
  private active = new Set<string>();

  start(runId: string) {
    if (this.active.has(runId)) return;
    this.active.add(runId);
    setImmediate(() => this.execute(runId).finally(() => this.active.delete(runId)));
  }

  async recover() {
    const interrupted = await prisma.agentRun.findMany({ where: { status: "running" }, select: { id: true } });
    for (const run of interrupted) this.start(run.id);
  }

  private async workspaceFor(session: any) {
    if (!session.projectId) return config.workspaceRoot;
    const project = await prisma.project.findUnique({ where: { id: session.projectId } });
    return project?.workspacePath || config.workspaceRoot;
  }

  private async conversation(run: any): Promise<ChatMessage[]> {
    const history = await prisma.message.findMany({ where: { sessionId: run.sessionId }, orderBy: { createdAt: "asc" }, take: 50 });
    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...history.map((m) => ({ role: m.role as ChatMessage["role"], content: m.content }))];
    const calls = await prisma.toolCall.findMany({ where: { agentRunId: run.id }, orderBy: { startedAt: "asc" } });
    for (const call of calls) {
      if (!call.resultJson) continue;
      messages.push({ role: "assistant", content: "", tool_calls: [{ id: call.providerCallId || call.id, type: "function", function: { name: call.toolName, arguments: call.argumentsJson } }] });
      messages.push({ role: "tool", tool_call_id: call.providerCallId || call.id, content: call.resultJson });
    }
    return messages;
  }

  private collectToolDelta(map: Map<number, Accumulator>, deltas: any[] = []) {
    for (const delta of deltas) {
      const index = delta.index ?? 0;
      const current = map.get(index) || { id: "", name: "", arguments: "" };
      if (delta.id) current.id = delta.id;
      if (delta.function?.name) current.name += delta.function.name;
      if (delta.function?.arguments) current.arguments += delta.function.arguments;
      map.set(index, current);
    }
  }

  private async createCall(run: any, call: CollectedToolCall) {
    let args: any;
    try { args = JSON.parse(call.arguments || "{}"); } catch { throw new Error(`Invalid arguments for ${call.name}`); }
    const classification = call.name === "terminal" ? classifyRisk(String(args.command || "")) : { risk: "low", requiresApproval: false, reason: "" };
    const tc = await prisma.toolCall.create({ data: {
      agentRunId: run.id, providerCallId: call.id, toolName: call.name, argumentsJson: JSON.stringify(args),
      riskLevel: classification.risk, approvalStatus: classification.requiresApproval ? "pending" : "auto_approved",
      executionStatus: classification.requiresApproval ? "pending" : "running", startedAt: classification.requiresApproval ? null : new Date(),
    } });
    await eventBus.emitEvent(run.sessionId, "tool.created", { toolCallId: tc.id, toolName: call.name, arguments: args });
    if (classification.requiresApproval) {
      await prisma.approval.create({ data: { toolCallId: tc.id } });
      await prisma.agentRun.update({ where: { id: run.id }, data: { status: "waiting_approval", currentStep: `approval:${tc.id}` } });
      await eventBus.emitEvent(run.sessionId, "tool.approval_required", { toolCallId: tc.id, toolName: call.name, arguments: args, riskLevel: classification.risk, reason: classification.reason });
      return { pending: true, tc, args };
    }
    return { pending: false, tc, args };
  }

  private async runTool(run: any, tc: any, args: any, workspaceRoot: string, approvalGranted = false) {
    await eventBus.emitEvent(run.sessionId, "tool.started", { toolCallId: tc.id, toolName: tc.toolName });
    let result: any;
    if (tc.toolName === "terminal") {
      const terminal = await prisma.terminalCommand.create({ data: { toolCallId: tc.id, sessionId: run.sessionId, commandDisplay: args.command, workingDirectory: args.cwd || workspaceRoot } });
      const output = await terminalRunner.runStreaming({ command: args.command, cwd: args.cwd, workspaceRoot, sessionId: run.sessionId, approvalGranted,
        onStdout: (chunk) => { void eventBus.emitEvent(run.sessionId, "tool.stdout", { toolCallId: tc.id, chunk }); },
        onStderr: (chunk) => { void eventBus.emitEvent(run.sessionId, "tool.stderr", { toolCallId: tc.id, chunk }); },
      });
      await prisma.terminalCommand.update({ where: { id: terminal.id }, data: { stdout: output.stdout, stderr: output.stderr, exitCode: output.exitCode, completedAt: new Date() } });
      result = output;
    } else if (tc.toolName === "read_file") {
      const absolute = validateWorkspacePath(workspaceRoot, args.path);
      const stat = await fs.stat(absolute);
      if (stat.size > MAX_FILE_BYTES) throw new Error("File exceeds 1MB limit");
      result = { path: args.path, content: await fs.readFile(absolute, "utf8") };
    } else if (tc.toolName === "write_file") {
      if (Buffer.byteLength(args.content || "") > MAX_FILE_BYTES) throw new Error("Content exceeds 1MB limit");
      const absolute = validateWorkspacePath(workspaceRoot, args.path);
      const existed = await fs.access(absolute).then(() => true).catch(() => false);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, args.content, "utf8");
      await prisma.fileChange.create({ data: { agentRunId: run.id, path: args.path, changeType: existed ? "modified" : "created" } });
      await eventBus.emitEvent(run.sessionId, existed ? "file.modified" : "file.created", { path: args.path });
      result = { path: args.path, bytesWritten: Buffer.byteLength(args.content) };
    } else if (tc.toolName === "list_files") {
      const absolute = validateWorkspacePath(workspaceRoot, args.path || ".");
      const entries = await fs.readdir(absolute, { withFileTypes: true });
      result = { path: args.path || ".", entries: entries.slice(0, 500).map((e) => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" })) };
    } else {
      throw new Error(`Unknown tool: ${tc.toolName}`);
    }
    const failed = tc.toolName === "terminal" && result.exitCode !== 0;
    await prisma.toolCall.update({ where: { id: tc.id }, data: { executionStatus: failed ? "failed" : "completed", resultJson: JSON.stringify(result), exitCode: result.exitCode ?? null, errorMessage: failed ? result.stderr || `Exit ${result.exitCode}` : null, completedAt: new Date() } });
    await eventBus.emitEvent(run.sessionId, failed ? "tool.failed" : "tool.completed", { toolCallId: tc.id, toolName: tc.toolName, result });
  }

  async execute(runId: string) {
    const run = await prisma.agentRun.findUnique({ where: { id: runId }, include: { session: true } });
    if (!run || ["completed", "failed", "cancelled", "paused"].includes(run.status)) return;
    const workspaceRoot = await this.workspaceFor(run.session);
    await fs.mkdir(workspaceRoot, { recursive: true });
    try {
      // `metadataJson` is present in the schema; retain this cast so a clean
      // checkout whose Prisma client has not yet been regenerated can still typecheck.
      const latestMessages = await (prisma.message as any).findMany({ where: { sessionId: run.sessionId }, orderBy: { createdAt: "desc" }, take: 8, select: { role: true, metadataJson: true } });
      const effort = requestedEffort(latestMessages);
      const effortConfig = {
        quick: { iterations: Math.min(MAX_ITERATIONS, 8), temperature: 0.35, maxTokens: 2048 },
        standard: { iterations: MAX_ITERATIONS, temperature: 0.2, maxTokens: 4096 },
        deep: { iterations: Math.max(MAX_ITERATIONS, 30), temperature: 0.15, maxTokens: 8192 },
      }[effort];
      const approved = await prisma.toolCall.findFirst({ where: { agentRunId: run.id, approvalStatus: "approved", executionStatus: "running", resultJson: null }, orderBy: { startedAt: "asc" } });
      if (approved) await this.runTool(run, approved, JSON.parse(approved.argumentsJson), workspaceRoot, true);
      await prisma.agentRun.update({ where: { id: run.id }, data: { status: "running", currentStep: "model" } });

      for (let iteration = 0; iteration < effortConfig.iterations; iteration++) {
        const fresh = await prisma.agentRun.findUnique({ where: { id: run.id } });
        if (!fresh || fresh.status === "cancelled" || fresh.status === "paused") return;
        const requestedProvider = run.session.selectedProvider;
        // Legacy mock selections must never be used in a real run. Resolve them
        // to the configured production provider instead of showing simulated GPT text.
        const providerId = !requestedProvider || requestedProvider === "mock" || (requestedProvider === "devin" && config.agent.defaultProvider !== "devin")
          ? providerRegistry.defaultProviderId()
          : requestedProvider;
        const model = !run.session.selectedModel || run.session.selectedModel.startsWith("mock-") || (run.session.selectedModel === "devin" && config.agent.defaultModel !== "devin")
          ? config.agent.defaultModel
          : run.session.selectedModel;
        if (!providerId) throw new Error("No production AI provider is configured. Connect a provider in server settings before starting an agent run.");
        const provider = providerRegistry.get(providerId);
        if (!provider) throw new Error("No production AI provider is configured. Connect a provider in server settings before starting an agent run.");
        const stream = await provider.chat({ model, messages: await this.conversation(run), tools, stream: true, temperature: effortConfig.temperature, max_tokens: effortConfig.maxTokens });
        let content = "";
        const accumulated = new Map<number, Accumulator>();
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) { content += delta.content; await eventBus.emitEvent(run.sessionId, "agent.thinking", { agentRunId: run.id, delta: delta.content }); }
          this.collectToolDelta(accumulated, delta?.tool_calls);
        }
        const requested = [...accumulated.values()].filter((x) => x.name).map((x, i) => ({ id: x.id || `call_${run.id}_${iteration}_${i}`, name: x.name, arguments: x.arguments }));
        if (!requested.length) {
          const assistant = await prisma.message.create({ data: { sessionId: run.sessionId, role: "assistant", content: content || "Task completed.", status: "completed" } });
          await prisma.agentRun.update({ where: { id: run.id }, data: { status: "completed", currentStep: "completed", completedAt: new Date() } });
          await prisma.plan.updateMany({ where: { agentRunId: run.id }, data: { status: "completed" } });
          await prisma.session.update({ where: { id: run.sessionId }, data: { status: "completed", completedAt: new Date() } });
          await eventBus.emitEvent(run.sessionId, "agent.completed", { agentRunId: run.id, messageId: assistant.id });
          return;
        }
        for (const call of requested) {
          const created = await this.createCall(run, call);
          if (created.pending) return;
          await this.runTool(run, created.tc, created.args, workspaceRoot);
        }
      }
      throw new Error(`Agent exceeded ${MAX_ITERATIONS} iterations`);
    } catch (error: any) {
      const updated = await prisma.agentRun.updateMany({ where: { id: run.id }, data: { status: "failed", errorMessage: error.message, completedAt: new Date() } });
      if (updated.count) await eventBus.emitEvent(run.sessionId, "agent.failed", { agentRunId: run.id, error: error.message });
    }
  }
}

export const agentEngine = new AgentEngine();
