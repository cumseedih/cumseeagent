import { buildApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

export async function buildTestApp() {
  const app = await buildApp();
  await app.ready();
  return app;
}

export async function cleanup() {
  // Clean relevant tables in order
  await prisma.terminalCommand.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.toolCall.deleteMany();
  await prisma.fileChange.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.event.deleteMany();
  await prisma.message.deleteMany();
  await prisma.session.deleteMany();
  await prisma.project.deleteMany();
  await prisma.auditLog.deleteMany();
  // Keep users for auth tests? Clean too but handle
  await prisma.user.deleteMany();
}

export async function createTestUser(app: any, email = `test-${Date.now()}@example.com`) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password: "test123456" },
  });
  const body = JSON.parse(res.body);
  return { user: body.user, token: body.token, email };
}

export function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}
