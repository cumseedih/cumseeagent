import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { validateWorkspacePath } from "../lib/pathValidator.js";
import { config } from "../lib/config.js";
import { agentEngine } from "../lib/agentEngine.js";
import { eventBus } from "../lib/events.js";
import { getOrCreateDefaultAgent } from "../lib/agentProfiles.js";

const skillSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).optional().nullable(),
  instructions: z.string().trim().min(3).max(12000),
});
const skillPatchSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(240).optional().nullable(),
  instructions: z.string().trim().min(3).max(12000).optional(),
  enabled: z.boolean().optional(),
}).refine((body) => Object.keys(body).length > 0, "Provide at least one field");
const workflowSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().nullable(),
  prompt: z.string().trim().min(3).max(12000),
  projectId: z.string().optional().nullable(),
});
const workflowPatchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(240).optional().nullable(),
  prompt: z.string().trim().min(3).max(12000).optional(),
  projectId: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
}).refine((body) => Object.keys(body).length > 0, "Provide at least one field");

function toSkill(skill: any) {
  let definition: any = {};
  try { definition = JSON.parse(skill.definitionJson); } catch { /* invalid legacy row remains editable */ }
  const { definitionJson: _private, ...publicSkill } = skill;
  return { ...publicSkill, instructions: typeof definition.instructions === "string" ? definition.instructions : "" };
}

function slugify(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "skill";
}

async function ownedProject(projectId: string | null | undefined, userId: string) {
  if (!projectId) return null;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  return project;
}

export async function libraryRoutes(app: FastifyInstance) {
  app.get("/artifacts", async (req) => {
    const userId = await getUserId(req);
    const query = req.query as { projectId?: string; sessionId?: string };
    const where: any = { userId };
    if (query.projectId) where.projectId = query.projectId;
    if (query.sessionId) where.sessionId = query.sessionId;
    const artifacts = await (prisma as any).artifact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, name: true, kind: true, mimeType: true, workspacePath: true, sizeBytes: true, status: true, projectId: true, sessionId: true, createdAt: true },
    });
    return { artifacts };
  });

  app.get("/artifacts/:artifactId/content", async (req, reply) => {
    const userId = await getUserId(req);
    const { artifactId } = req.params as any;
    const artifact = await (prisma as any).artifact.findFirst({ where: { id: artifactId, userId } });
    if (!artifact) return reply.code(404).send({ error: "Artifact not found" });
    const project = artifact.projectId ? await prisma.project.findFirst({ where: { id: artifact.projectId, userId } }) : null;
    if (artifact.projectId && !project) return reply.code(404).send({ error: "Artifact workspace not found" });
    const root = project?.workspacePath || config.workspaceRoot;
    let absolute: string;
    let canonicalRoot: string;
    let canonicalFile: string;
    try {
      absolute = validateWorkspacePath(root, artifact.workspacePath);
      [canonicalRoot, canonicalFile] = await Promise.all([fs.realpath(root), fs.realpath(absolute)]);
    } catch {
      return reply.code(404).send({ error: "Artifact file not found" });
    }
    const relative = path.relative(canonicalRoot, canonicalFile);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return reply.code(403).send({ error: "Artifact path is outside its workspace" });
    const stat = await fs.stat(canonicalFile).catch(() => null);
    if (!stat?.isFile()) return reply.code(404).send({ error: "Artifact file not found" });
    if (stat.size > 2_000_000) return reply.code(413).send({ error: "Artifact is too large to preview" });
    const content = await fs.readFile(canonicalFile, "utf8");
    return { artifact: { id: artifact.id, name: artifact.name, kind: artifact.kind, mimeType: artifact.mimeType, sizeBytes: stat.size }, content };
  });

  app.get("/skills", async (req) => {
    const userId = await getUserId(req);
    const skills = await (prisma as any).agentSkill.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
    return { skills: skills.map(toSkill) };
  });

  app.post("/skills", async (req, reply) => {
    const userId = await getUserId(req);
    const parsed = skillSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid skill", details: parsed.error.flatten() });
    const base = slugify(parsed.data.name);
    const slug = `${base}-${crypto.randomUUID().slice(0, 6)}`;
    const skill = await (prisma as any).agentSkill.create({
      data: { userId, name: parsed.data.name, slug, description: parsed.data.description || null, definitionJson: JSON.stringify({ instructions: parsed.data.instructions }) },
    });
    return reply.code(201).send({ skill: toSkill(skill) });
  });

  app.patch("/skills/:skillId", async (req, reply) => {
    const userId = await getUserId(req);
    const { skillId } = req.params as any;
    const parsed = skillPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid skill update", details: parsed.error.flatten() });
    const current = await (prisma as any).agentSkill.findFirst({ where: { id: skillId, userId } });
    if (!current) return reply.code(404).send({ error: "Skill not found" });
    let instructions: string | undefined;
    if (parsed.data.instructions !== undefined) instructions = parsed.data.instructions;
    else {
      try { instructions = JSON.parse(current.definitionJson).instructions || ""; } catch { instructions = ""; }
    }
    const skill = await (prisma as any).agentSkill.update({
      where: { id: skillId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description === undefined ? undefined : parsed.data.description || null,
        enabled: parsed.data.enabled,
        definitionJson: parsed.data.instructions === undefined ? undefined : JSON.stringify({ instructions }),
      },
    });
    return { skill: toSkill(skill) };
  });

  app.delete("/skills/:skillId", async (req, reply) => {
    const userId = await getUserId(req);
    const { skillId } = req.params as any;
    const result = await (prisma as any).agentSkill.deleteMany({ where: { id: skillId, userId } });
    if (!result.count) return reply.code(404).send({ error: "Skill not found" });
    return reply.code(204).send();
  });

  app.get("/workflows", async (req) => {
    const userId = await getUserId(req);
    const workflows = await (prisma as any).workflow.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: { runs: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true, status: true, startedAt: true, completedAt: true, errorMessage: true, createdAt: true } } },
    });
    return { workflows };
  });

  app.post("/workflows", async (req, reply) => {
    const userId = await getUserId(req);
    const parsed = workflowSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid workflow", details: parsed.error.flatten() });
    const project = await ownedProject(parsed.data.projectId, userId);
    if (parsed.data.projectId && !project) return reply.code(404).send({ error: "Project not found" });
    const workflow = await (prisma as any).workflow.create({
      data: { userId, projectId: project?.id || null, name: parsed.data.name, description: parsed.data.description || null, prompt: parsed.data.prompt, triggerType: "manual" },
    });
    return reply.code(201).send({ workflow });
  });

  app.patch("/workflows/:workflowId", async (req, reply) => {
    const userId = await getUserId(req);
    const { workflowId } = req.params as any;
    const parsed = workflowPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid workflow update", details: parsed.error.flatten() });
    const current = await (prisma as any).workflow.findFirst({ where: { id: workflowId, userId } });
    if (!current) return reply.code(404).send({ error: "Workflow not found" });
    if (parsed.data.projectId !== undefined) {
      const project = await ownedProject(parsed.data.projectId, userId);
      if (parsed.data.projectId && !project) return reply.code(404).send({ error: "Project not found" });
    }
    const workflow = await (prisma as any).workflow.update({
      where: { id: workflowId },
      data: { ...parsed.data, projectId: parsed.data.projectId === undefined ? undefined : parsed.data.projectId || null },
    });
    return { workflow };
  });

  app.delete("/workflows/:workflowId", async (req, reply) => {
    const userId = await getUserId(req);
    const { workflowId } = req.params as any;
    const result = await (prisma as any).workflow.deleteMany({ where: { id: workflowId, userId } });
    if (!result.count) return reply.code(404).send({ error: "Workflow not found" });
    return reply.code(204).send();
  });

  app.post("/workflows/:workflowId/run", async (req, reply) => {
    const userId = await getUserId(req);
    const { workflowId } = req.params as any;
    const workflow = await (prisma as any).workflow.findFirst({ where: { id: workflowId, userId } });
    if (!workflow) return reply.code(404).send({ error: "Workflow not found" });
    if (!workflow.enabled) return reply.code(409).send({ error: "Enable this workflow before running it" });
    const project = await ownedProject(workflow.projectId, userId);
    if (workflow.projectId && !project) return reply.code(404).send({ error: "Project not found" });

    if (config.dailyRunLimit > 0) {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const usedToday = await prisma.agentRun.count({ where: { startedAt: { gte: dayStart }, session: { userId } } });
      if (usedToday >= config.dailyRunLimit) return reply.code(429).send({ error: "Out of credits for today", code: "quota_exhausted", used: usedToday, limit: config.dailyRunLimit });
    }

    const defaultAgent = await getOrCreateDefaultAgent(userId);
    const session = await prisma.session.create({ data: { userId, projectId: project?.id || null, agentProfileId: defaultAgent.id, title: workflow.name, status: "active" } });
    const message = await prisma.message.create({ data: { sessionId: session.id, role: "user", content: workflow.prompt, metadataJson: JSON.stringify({ mentions: [], effort: "standard", workflowId }), status: "completed" } as any });
    const agentRun = await prisma.agentRun.create({ data: { sessionId: session.id, status: "running", goal: workflow.prompt.slice(0, 500), currentStep: "analyzing" } });
    const workflowRun = await (prisma as any).workflowRun.create({ data: { workflowId, userId, agentRunId: agentRun.id, status: "running", triggeredBy: "manual", startedAt: new Date() } });
    await eventBus.emitEvent(session.id, "session.created", { sessionId: session.id, title: session.title, workflowId });
    await eventBus.emitEvent(session.id, "agent.started", { agentRunId: agentRun.id, goal: workflow.prompt, workflowId });
    await prisma.auditLog.create({ data: { userId, sessionId: session.id, action: "workflow.run", metadataJson: JSON.stringify({ workflowId, workflowRunId: workflowRun.id }), ipAddress: req.ip } });
    agentEngine.start(agentRun.id);
    return reply.code(201).send({ workflowRun, session, message, agentRun });
  });
}
