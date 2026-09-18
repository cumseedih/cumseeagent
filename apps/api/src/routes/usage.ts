import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";
import { getUserId } from "./auth.js";

/**
 * Daily run quota + terms consent.
 *
 * These are the two server-side pieces of the pre-flight flow: the workspace
 * gates the first session behind a Terms of Use agreement, and refuses new
 * runs once the day's credit allowance is gone.
 */

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfUtcDay(d = new Date()) {
  const s = startOfUtcDay(d);
  return new Date(s.getTime() + 24 * 60 * 60 * 1000);
}

export async function usageRoutes(app: FastifyInstance) {
  /** GET /api/usage — credits consumed today against the configured limit. */
  app.get("/usage", async (req) => {
    const userId = await getUserId(req);
    const limit = config.dailyRunLimit;
    const windowStart = startOfUtcDay();
    const resetsAt = endOfUtcDay();

    const used = await prisma.agentRun.count({
      where: {
        startedAt: { gte: windowStart },
        session: { userId },
      },
    });

    const remaining = limit > 0 ? Math.max(0, limit - used) : Number.POSITIVE_INFINITY;
    return {
      used,
      limit,
      remaining: limit > 0 ? remaining : null,
      exhausted: limit > 0 ? remaining <= 0 : false,
      unlimited: limit <= 0,
      windowStart: windowStart.toISOString(),
      resetsAt: resetsAt.toISOString(),
    };
  });
}

export async function consentRoutes(app: FastifyInstance) {
  /** GET /api/auth/tou — has this user accepted the current terms version? */
  app.get("/tou", async (req) => {
    const userId = await getUserId(req);
    const latest = await prisma.auditLog.findFirst({
      where: { userId, action: "tou.accept" },
      orderBy: { createdAt: "desc" },
    });
    let acceptedVersion: string | null = null;
    if (latest?.metadataJson) {
      try {
        acceptedVersion = JSON.parse(latest.metadataJson)?.version ?? null;
      } catch {
        acceptedVersion = null;
      }
    }
    return {
      version: config.touVersion,
      accepted: acceptedVersion === config.touVersion,
      acceptedVersion,
      acceptedAt: latest?.createdAt?.toISOString() ?? null,
    };
  });

  /** PUT /api/auth/tou — record consent for the current terms version. */
  app.put("/tou", async (req, reply) => {
    const userId = await getUserId(req);
    const body = (req.body ?? {}) as { version?: string };
    const version = body.version || config.touVersion;

    const entry = await prisma.auditLog.create({
      data: {
        userId,
        action: "tou.accept",
        ipAddress: req.ip,
        metadataJson: JSON.stringify({ version }),
      },
    });

    return reply.code(201).send({
      accepted: true,
      version,
      acceptedAt: entry.createdAt.toISOString(),
    });
  });
}
