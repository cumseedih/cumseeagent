import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getOrCreateDefaultAgent } from "../lib/agentProfiles.js";
import { getUserId } from "./auth.js";

const agentCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  instructions: z.string().trim().max(12000).optional().default(""),
  memory: z.string().trim().max(12000).optional().default(""),
  avatarUrl: z.string().url().max(2048).optional().nullable(),
});
const agentPatchSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  instructions: z.string().trim().max(12000).optional(),
  memory: z.string().trim().max(12000).optional(),
  avatarUrl: z.string().url().max(2048).optional().nullable(),
  isPinned: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, "Provide at least one field");
const groupCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  agentIds: z.array(z.string().min(1)).min(1).max(8),
});
const groupPatchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  agentIds: z.array(z.string().min(1)).min(1).max(8).optional(),
  isPinned: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, "Provide at least one field");

const groupInclude = {
  members: {
    orderBy: { createdAt: "asc" as const },
    include: { agentProfile: { select: { id: true, name: true, avatarUrl: true, isDefault: true, isPinned: true } } },
  },
  _count: { select: { sessions: true, members: true } },
};

function publicGroup(group: any) {
  return {
    id: group.id,
    userId: group.userId,
    name: group.name,
    isPinned: group.isPinned,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    agents: (group.members || []).map((member: any) => member.agentProfile),
    sessionCount: group._count?.sessions ?? 0,
  };
}

async function validateOwnedAgentIds(userId: string, ids: string[]) {
  if (new Set(ids).size !== ids.length) return false;
  const count = await prisma.agentProfile.count({ where: { userId, id: { in: ids } } });
  return count === ids.length;
}

export async function agentRoutes(app: FastifyInstance) {
  app.get("/agents", async (req) => {
    const userId = await getUserId(req);
    await getOrCreateDefaultAgent(userId);
    const agents = await prisma.agentProfile.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { isPinned: "desc" }, { updatedAt: "desc" }],
      include: { _count: { select: { sessions: true, memberships: true } } },
    });
    return { agents };
  });

  app.post("/agents", async (req, reply) => {
    const userId = await getUserId(req);
    const parsed = agentCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid Agent profile", details: parsed.error.flatten() });
    try {
      const agent = await prisma.agentProfile.create({ data: { ...parsed.data, userId } });
      await prisma.auditLog.create({ data: { userId, action: "agent_profile.create", metadataJson: JSON.stringify({ agentId: agent.id }), ipAddress: req.ip } });
      return reply.code(201).send({ agent });
    } catch (error: any) {
      if (error?.code === "P2002") return reply.code(409).send({ error: "An Agent with this name already exists" });
      throw error;
    }
  });

  app.patch("/agents/:agentId", async (req, reply) => {
    const userId = await getUserId(req);
    const { agentId } = req.params as any;
    const parsed = agentPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid Agent profile update", details: parsed.error.flatten() });
    const current = await prisma.agentProfile.findFirst({ where: { id: agentId, userId } });
    if (!current) return reply.code(404).send({ error: "Agent not found" });
    if (current.isDefault && parsed.data.name !== undefined && parsed.data.name !== current.name) {
      return reply.code(409).send({ error: "The default Agent cannot be renamed" });
    }
    try {
      const agent = await prisma.agentProfile.update({ where: { id: agentId }, data: parsed.data });
      await prisma.auditLog.create({ data: { userId, action: "agent_profile.update", metadataJson: JSON.stringify({ agentId }), ipAddress: req.ip } });
      return { agent };
    } catch (error: any) {
      if (error?.code === "P2002") return reply.code(409).send({ error: "An Agent with this name already exists" });
      throw error;
    }
  });

  app.delete("/agents/:agentId", async (req, reply) => {
    const userId = await getUserId(req);
    const { agentId } = req.params as any;
    const agent = await prisma.agentProfile.findFirst({ where: { id: agentId, userId } });
    if (!agent) return reply.code(404).send({ error: "Agent not found" });
    if (agent.isDefault) return reply.code(409).send({ error: "The default Agent cannot be deleted" });

    const memberships = await prisma.groupChatMember.findMany({
      where: { agentProfileId: agentId, groupChat: { userId } },
      include: { groupChat: { include: { _count: { select: { members: true } } } } },
    });
    if (memberships.some((member) => member.groupChat._count.members <= 1)) {
      return reply.code(409).send({ error: "Remove this Agent from or add another Agent to its Group Chat before deleting it" });
    }
    await prisma.agentProfile.delete({ where: { id: agentId } });
    await prisma.auditLog.create({ data: { userId, action: "agent_profile.delete", metadataJson: JSON.stringify({ agentId }), ipAddress: req.ip } });
    return reply.code(204).send();
  });

  app.get("/groups", async (req) => {
    const userId = await getUserId(req);
    await getOrCreateDefaultAgent(userId);
    const groups = await prisma.groupChat.findMany({
      where: { userId },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      include: groupInclude,
    });
    return { groups: groups.map(publicGroup) };
  });

  app.post("/groups", async (req, reply) => {
    const userId = await getUserId(req);
    const parsed = groupCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid Group Chat", details: parsed.error.flatten() });
    if (!(await validateOwnedAgentIds(userId, parsed.data.agentIds))) {
      return reply.code(400).send({ error: "Choose distinct Agents from your account" });
    }
    try {
      const group = await prisma.groupChat.create({
        data: {
          userId,
          name: parsed.data.name,
          members: { create: parsed.data.agentIds.map((agentProfileId) => ({ agentProfileId })) },
        },
        include: groupInclude,
      });
      await prisma.auditLog.create({ data: { userId, action: "group_chat.create", metadataJson: JSON.stringify({ groupChatId: group.id }), ipAddress: req.ip } });
      return reply.code(201).send({ group: publicGroup(group) });
    } catch (error: any) {
      if (error?.code === "P2002") return reply.code(409).send({ error: "A Group Chat with this name already exists" });
      throw error;
    }
  });

  app.patch("/groups/:groupId", async (req, reply) => {
    const userId = await getUserId(req);
    const { groupId } = req.params as any;
    const parsed = groupPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid Group Chat update", details: parsed.error.flatten() });
    const current = await prisma.groupChat.findFirst({ where: { id: groupId, userId } });
    if (!current) return reply.code(404).send({ error: "Group Chat not found" });
    if (parsed.data.agentIds && !(await validateOwnedAgentIds(userId, parsed.data.agentIds))) {
      return reply.code(400).send({ error: "A Group Chat must contain distinct Agents from your account" });
    }
    try {
      const group = await prisma.$transaction(async (tx) => {
        if (parsed.data.agentIds) {
          await tx.groupChatMember.deleteMany({ where: { groupChatId: groupId } });
          await tx.groupChatMember.createMany({ data: parsed.data.agentIds.map((agentProfileId) => ({ groupChatId: groupId, agentProfileId })) });
        }
        return tx.groupChat.update({ where: { id: groupId }, data: { name: parsed.data.name, isPinned: parsed.data.isPinned }, include: groupInclude });
      });
      await prisma.auditLog.create({ data: { userId, action: "group_chat.update", metadataJson: JSON.stringify({ groupChatId: group.id }), ipAddress: req.ip } });
      return { group: publicGroup(group) };
    } catch (error: any) {
      if (error?.code === "P2002") return reply.code(409).send({ error: "A Group Chat with this name already exists" });
      throw error;
    }
  });

  app.delete("/groups/:groupId", async (req, reply) => {
    const userId = await getUserId(req);
    const { groupId } = req.params as any;
    const result = await prisma.groupChat.deleteMany({ where: { id: groupId, userId } });
    if (!result.count) return reply.code(404).send({ error: "Group Chat not found" });
    await prisma.auditLog.create({ data: { userId, action: "group_chat.delete", metadataJson: JSON.stringify({ groupChatId: groupId }), ipAddress: req.ip } });
    return reply.code(204).send();
  });
}
