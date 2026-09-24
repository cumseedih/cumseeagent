import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import { config } from "../lib/config.js";
import { createGoogleState, exchangeGoogleWorkspaceCode, googleAuthorizationUrl, verifyGoogleState } from "../lib/googleOAuth.js";
import { getUserId } from "./auth.js";
import { prisma } from "../lib/prisma.js";
import { seal } from "../lib/secretBox.js";

const services = ["gmail", "calendar", "drive", "docs", "sheets", "slides"] as const;

async function findConnection(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ googleEmail: string; scopes: string }>>`SELECT "googleEmail", "scopes" FROM "GoogleConnection" WHERE "userId" = ${userId} LIMIT 1`;
  return rows[0] || null;
}

export async function googleIntegrationRoutes(app: FastifyInstance) {
  app.get("/status", async (req) => {
    const userId = await getUserId(req);
    const connection = await findConnection(userId);
    return { connected: Boolean(connection), email: connection?.googleEmail || null, services: Object.fromEntries(services.map((service) => [service, Boolean(connection)])) };
  });

  app.get("/connect", async (req, reply) => {
    if (!config.google.clientId || !config.google.clientSecret) return reply.code(503).send({ error: "Google OAuth is not configured" });
    const userId = await getUserId(req);
    const state = createGoogleState();
    // Keep the OAuth state separate from identity; the existing session cookie is
    // used to resolve the account again on callback.
    reply.setCookie("delvin_google_workspace_state", state, { httpOnly: true, secure: config.nodeEnv === "production", sameSite: "lax", path: "/", maxAge: 600 });
    return reply.redirect(googleAuthorizationUrl(state, true));
  });

  app.get("/callback", async (req, reply) => {
    const query = req.query as { code?: string; state?: string; error?: string };
    const cookie = (req.cookies as any)?.delvin_google_workspace_state as string | undefined;
    const state = cookie;
    if (query.error || !query.code || !query.state || query.state !== state || !verifyGoogleState(state)) return reply.redirect(`${config.publicAppUrl}/?google_error=connection_failed`);
    try {
      const userId = await getUserId(req);
      const tokens = await exchangeGoogleWorkspaceCode(query.code);
      const refresh = tokens.refresh_token ? seal(tokens.refresh_token) : null;
      const expiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;
      await prisma.$executeRaw`INSERT INTO "GoogleConnection" ("id", "userId", "googleEmail", "scopes", "accessTokenEncrypted", "refreshTokenEncrypted", "expiresAt", "createdAt", "updatedAt") VALUES (${crypto.randomUUID()}, ${userId!}, ${tokens.email}, ${tokens.scopes}, ${seal(tokens.access_token!)}, ${refresh}, ${expiry}, NOW(), NOW()) ON CONFLICT ("userId") DO UPDATE SET "googleEmail" = EXCLUDED."googleEmail", "scopes" = EXCLUDED."scopes", "accessTokenEncrypted" = EXCLUDED."accessTokenEncrypted", "refreshTokenEncrypted" = COALESCE(EXCLUDED."refreshTokenEncrypted", "GoogleConnection"."refreshTokenEncrypted"), "expiresAt" = EXCLUDED."expiresAt", "updatedAt" = NOW()`;
      reply.clearCookie("delvin_google_workspace_state", { path: "/" });
      return reply.redirect(`${config.publicAppUrl}/?google=connected`);
    } catch (error: any) {
      req.log.error(error, "Google workspace callback failed");
      return reply.redirect(`${config.publicAppUrl}/?google_error=connection_failed`);
    }
  });

  app.delete("/connection", async (req) => {
    const userId = await getUserId(req);
    await prisma.$executeRaw`DELETE FROM "GoogleConnection" WHERE "userId" = ${userId}`;
    return { ok: true };
  });
}
