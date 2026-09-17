import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "0.1.0",
    product: config.branding.productName,
  }));

  app.get("/ready", async (req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ready", db: "connected" };
    } catch (e: any) {
      reply.code(503);
      return { status: "not ready", db: "disconnected", error: e.message };
    }
  });

  app.get("/version", async () => ({
    version: "0.1.0",
    node: process.version,
    env: config.nodeEnv,
    branding: config.branding,
  }));
}
