import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { config } from "./lib/config.js";
import { healthRoutes } from "./routes/health.js";
import { usageRoutes, consentRoutes } from "./routes/usage.js";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { sessionRoutes } from "./routes/sessions.js";
import { messageRoutes } from "./routes/messages.js";
import { runRoutes } from "./routes/runs.js";
import { planRoutes } from "./routes/plans.js";
import { toolCallRoutes } from "./routes/toolCalls.js";
import { fileRoutes } from "./routes/files.js";
import { terminalRoutes } from "./routes/terminal.js";
import { gitRoutes } from "./routes/git.js";
import { modelRoutes } from "./routes/models.js";
import { eventRoutes } from "./routes/events.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
  });
  await app.register(cookie);
  await app.register(sensible);
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
  });

  // Health without prefix for simplicity, also under /api
  await app.register(async (f) => {
    await f.register(healthRoutes);
  });

  // API prefix
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(projectRoutes, { prefix: "/projects" });
      await api.register(sessionRoutes, { prefix: "/sessions" });
      await api.register(messageRoutes, { prefix: "/sessions" }); // uses :sessionId
      await api.register(runRoutes); // includes /sessions/:id/runs and /runs/:id
      await api.register(planRoutes);
      await api.register(toolCallRoutes);
      await api.register(fileRoutes);
      await api.register(terminalRoutes);
      await api.register(gitRoutes);
      await api.register(modelRoutes);
      await api.register(eventRoutes);
      // Also expose health under /api
      await api.register(healthRoutes);
      await api.register(usageRoutes);
      await api.register(consentRoutes, { prefix: "/auth" });
    },
    { prefix: "/api" }
  );

  // Root branding info
  app.get("/", async () => ({
    name: config.branding.productName,
    domain: config.branding.productDomain,
    version: "0.1.0",
    status: "ok",
  }));

  return app;
}
