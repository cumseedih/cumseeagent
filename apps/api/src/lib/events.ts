import { EventEmitter } from "events";
import { prisma } from "./prisma.js";

export type EventType =
  | "session.created"
  | "agent.started"
  | "agent.thinking"
  | "agent.plan.created"
  | "agent.plan.updated"
  | "tool.created"
  | "tool.approval_required"
  | "tool.approved"
  | "tool.rejected"
  | "tool.started"
  | "tool.stdout"
  | "tool.stderr"
  | "tool.completed"
  | "tool.failed"
  | "file.created"
  | "file.modified"
  | "file.deleted"
  | "git.status.updated"
  | "test.started"
  | "test.completed"
  | "build.started"
  | "build.completed"
  | "agent.retrying"
  | "agent.paused"
  | "agent.resumed"
  | "agent.completed"
  | "agent.failed"
  | "notification.created";

export interface CumseeEvent {
  id: string;
  sessionId: string;
  eventType: EventType;
  payload: any;
  createdAt: string;
}

class EventBus extends EventEmitter {
  // Store in DB + emit to listeners
  async emitEvent(sessionId: string, eventType: EventType, payload: any): Promise<CumseeEvent> {
    const event = await prisma.event.create({
      data: {
        sessionId,
        eventType,
        payloadJson: JSON.stringify(payload),
      },
    });

    const cumseeEvent: CumseeEvent = {
      id: event.id,
      sessionId,
      eventType,
      payload,
      createdAt: event.createdAt.toISOString(),
    };

    // Emit to SSE listeners
    this.emit(`session:${sessionId}`, cumseeEvent);
    this.emit("event", cumseeEvent);

    return cumseeEvent;
  }

  subscribe(sessionId: string, handler: (e: CumseeEvent) => void) {
    this.on(`session:${sessionId}`, handler);
    return () => this.off(`session:${sessionId}`, handler);
  }

  async getHistory(sessionId: string, limit = 100): Promise<CumseeEvent[]> {
    const events = await prisma.event.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return events.map((e) => ({
      id: e.id,
      sessionId: e.sessionId,
      eventType: e.eventType as EventType,
      payload: JSON.parse(e.payloadJson),
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async getHistorySince(sessionId: string, sinceId?: string): Promise<CumseeEvent[]> {
    if (!sinceId) return this.getHistory(sessionId, 1000);
    const since = await prisma.event.findUnique({ where: { id: sinceId } });
    if (!since) return this.getHistory(sessionId, 1000);
    const events = await prisma.event.findMany({
      where: { sessionId, createdAt: { gt: since.createdAt } },
      orderBy: { createdAt: "asc" },
      take: 1000,
    });
    return events.map((e) => ({
      id: e.id,
      sessionId: e.sessionId,
      eventType: e.eventType as EventType,
      payload: JSON.parse(e.payloadJson),
      createdAt: e.createdAt.toISOString(),
    }));
  }
}

export const eventBus = new EventBus();
