import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getUserId } from "./auth.js";
import { eventBus } from "../lib/events.js";

export async function eventRoutes(app: FastifyInstance) {
  // GET /api/sessions/:sessionId/events
  app.get("/sessions/:sessionId/events", async (req, reply) => {
    const { sessionId } = req.params as any;
    const query = req.query as any;
    const limit = Math.min(parseInt(query.limit || "100", 10), 1000);
    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const events = await prisma.event.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return {
      events: events.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        eventType: e.eventType,
        payload: JSON.parse(e.payloadJson),
        createdAt: e.createdAt.toISOString(),
      })),
    };
  });

  // GET /api/sessions/:sessionId/stream — SSE
  app.get("/sessions/:sessionId/stream", async (req, reply) => {
    const { sessionId } = req.params as any;
    const query = req.query as any;
    const lastEventId = query.lastEventId as string | undefined;

    const userId = await getUserId(req);
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    if (session.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    });

    const sendEvent = (event: any) => {
      const data = `id: ${event.id}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`;
      reply.raw.write(data);
    };

    // Send history since lastEventId
    const history = await eventBus.getHistorySince(sessionId, lastEventId);
    for (const ev of history) {
      sendEvent(ev);
    }

    // Heartbeat
    const heartbeat = setInterval(() => {
      reply.raw.write(`: heartbeat\n\n`);
    }, 15000);

    // Subscribe to new events
    const handler = (ev: any) => {
      sendEvent(ev);
    };
    const unsubscribe = eventBus.subscribe(sessionId, handler);

    // Cleanup on close
    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      try {
        reply.raw.end();
      } catch {}
    });

    // Also handle client disconnect via raw
    reply.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    // Keep connection open
    return reply;
  });
}
