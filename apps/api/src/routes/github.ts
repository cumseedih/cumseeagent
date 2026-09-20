import type { FastifyInstance } from "fastify";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";
import { getUserId } from "./auth.js";
import { createGitHubState, getInstallation, gitAuthEnvironment, installationRepositories, installationToken, verifyGitHubState } from "../lib/githubApp.js";
import { terminalRunner } from "../lib/terminalRunner.js";

const cloneSchema = z.object({ repositoryId: z.string().min(1) });

function secureCookie() {
  return { httpOnly: true, secure: config.nodeEnv === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
}

export async function githubRoutes(app: FastifyInstance) {
  app.get("/status", async (req) => {
    const userId = await getUserId(req);
    const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
    return { connected: Boolean(connection), connection: connection ? { accountLogin: connection.accountLogin, accountType: connection.accountType } : null };
  });

  app.get("/connect", async (req, reply) => {
    const userId = await getUserId(req);
    if (!config.github.appId || (!config.github.privateKeyPath && !config.github.privateKeyBase64)) return reply.code(503).send({ error: "GitHub integration is not configured on this server" });
    const state = createGitHubState(userId);
    reply.setCookie("delvin_github_state", state, secureCookie());
    return reply.redirect(`https://github.com/apps/${encodeURIComponent(config.github.appSlug)}/installations/new?state=${encodeURIComponent(state)}`);
  });

  app.get("/setup", async (req, reply) => {
    const query = req.query as { installation_id?: string; state?: string };
    const cookieState = (req.cookies as any)?.delvin_github_state as string | undefined;
    // GitHub returns our signed state in the setup callback. Prefer it so the
    // connection survives mobile browsers that drop cookies while switching
    // between Delvin and github.com. If both values exist, they must agree.
    const callbackState = query.state || cookieState;
    const userId = verifyGitHubState(callbackState);
    if (!userId || !query.installation_id || (query.state && cookieState && query.state !== cookieState)) return reply.code(400).send({ error: "GitHub connection state expired or invalid. Start the connection again." });
    try {
      const installation = await getInstallation(query.installation_id);
      await prisma.gitHubConnection.upsert({
        where: { userId },
        create: { userId, installationId: installation.id, accountLogin: installation.accountLogin, accountType: installation.accountType },
        update: { installationId: installation.id, accountLogin: installation.accountLogin, accountType: installation.accountType },
      });
      await prisma.auditLog.create({ data: { userId, action: "github.connect", metadataJson: JSON.stringify({ installationId: installation.id, account: installation.accountLogin }), ipAddress: req.ip } });
      reply.clearCookie("delvin_github_state", { path: "/" });
      return reply.redirect("/?github=connected");
    } catch (error: any) {
      req.log.error(error, "GitHub installation setup failed");
      return reply.code(502).send({ error: "GitHub could not finish the connection" });
    }
  });

  app.delete("/connection", async (req) => {
    const userId = await getUserId(req);
    await prisma.gitHubConnection.deleteMany({ where: { userId } });
    await prisma.auditLog.create({ data: { userId, action: "github.disconnect", ipAddress: req.ip } });
    return { disconnected: true };
  });

  app.get("/repositories", async (req, reply) => {
    const userId = await getUserId(req);
    const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
    if (!connection) return reply.code(409).send({ error: "Connect GitHub first" });
    try {
      return { repositories: await installationRepositories(connection.installationId) };
    } catch (error: any) {
      req.log.error(error, "GitHub repository listing failed");
      return reply.code(502).send({ error: "Could not load GitHub repositories" });
    }
  });

  app.post("/repositories/clone", async (req, reply) => {
    const parsed = cloneSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid repository" });
    const userId = await getUserId(req);
    const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
    if (!connection) return reply.code(409).send({ error: "Connect GitHub first" });
    try {
      const repositories = await installationRepositories(connection.installationId);
      const repository = repositories.find((item) => item.id === parsed.data.repositoryId);
      if (!repository) return reply.code(403).send({ error: "That repository is not available to this GitHub App installation" });
      const project = await prisma.project.create({ data: { userId, name: repository.fullName, repositoryUrl: repository.htmlUrl, defaultBranch: repository.defaultBranch, workspacePath: `tmp-${Date.now()}` } });
      const workspacePath = path.join(config.workspaceRoot, project.id);
      await fs.mkdir(workspacePath, { recursive: true });
      await terminalRunner.run({ command: `git clone --branch ${JSON.stringify(repository.defaultBranch)} --single-branch ${JSON.stringify(repository.cloneUrl)} .`, cwd: workspacePath, workspaceRoot: workspacePath, env: gitAuthEnvironment(await installationToken(connection.installationId)), approvalGranted: true, timeoutMs: 120_000 });
      const updated = await prisma.project.update({ where: { id: project.id }, data: { workspacePath } });
      await prisma.auditLog.create({ data: { userId, action: "github.clone", metadataJson: JSON.stringify({ projectId: project.id, repository: repository.fullName }), ipAddress: req.ip } });
      return reply.code(201).send({ project: updated });
    } catch (error: any) {
      req.log.error(error, "GitHub clone failed");
      return reply.code(502).send({ error: "Could not clone the selected repository" });
    }
  });
}
