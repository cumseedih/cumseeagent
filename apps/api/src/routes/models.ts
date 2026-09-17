import type { FastifyInstance } from "fastify";
import { providerRegistry } from "../lib/providers/registry.js";

export async function modelRoutes(app: FastifyInstance) {
  // GET /api/models
  app.get("/models", async () => {
    const models = await providerRegistry.listModels();
    return { models };
  });

  // GET /api/providers
  app.get("/providers", async () => {
    const providers = providerRegistry.list().map((p) => ({ id: p.id, name: p.name }));
    return { providers };
  });

  // GET /api/providers/:providerId/health
  app.get("/providers/:providerId/health", async (req, reply) => {
    const { providerId } = req.params as any;
    try {
      const health = await providerRegistry.health(providerId);
      return { providerId, health };
    } catch (e: any) {
      return reply.code(404).send({ error: e.message });
    }
  });
}
