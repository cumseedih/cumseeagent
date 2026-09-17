// SSE client with reconnect + Last-Event-ID

export type CumseeEvent = {
  id: string;
  sessionId: string;
  eventType: string;
  payload: any;
  createdAt: string;
};

export function connectSSE(sessionId: string, onEvent: (e: CumseeEvent) => void, onError?: (e: any) => void) {
  let lastEventId: string | undefined;
  let es: EventSource | null = null;
  let closed = false;
  let retryMs = 1000;

  function getToken(): string | null {
    try {
      return localStorage.getItem("cumsee_token") || localStorage.getItem("token") || null;
    } catch {
      return null;
    }
  }

  function buildUrl() {
    const params = new URLSearchParams();
    if (lastEventId) params.set("lastEventId", lastEventId);
    const token = getToken();
    if (token) params.set("token", token);
    const qs = params.toString();
    return `/api/sessions/${sessionId}/stream${qs ? `?${qs}` : ""}`;
  }

  function connect() {
    if (closed) return;
    const url = buildUrl();
    try {
      es = new EventSource(url);
    } catch {
      fetchStream(url, onEvent);
      return;
    }

    es.onmessage = (msg: MessageEvent) => {
      try {
        const ev = JSON.parse((msg as any).data || msg.data);
        const parsed: CumseeEvent = ev.id ? ev : JSON.parse((msg as any).data);
        if (parsed.id) lastEventId = parsed.id;
        onEvent(parsed);
      } catch (e) {
        try {
          const data = (msg as any).data;
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.id) lastEventId = parsed.id;
            onEvent(parsed);
          }
        } catch {}
      }
      retryMs = 1000;
    };

    const namedEvents = [
      "session.created",
      "agent.started",
      "agent.thinking",
      "agent.plan.created",
      "agent.plan.updated",
      "tool.created",
      "tool.approval_required",
      "tool.approved",
      "tool.rejected",
      "tool.started",
      "tool.stdout",
      "tool.stderr",
      "tool.completed",
      "tool.failed",
      "file.created",
      "file.modified",
      "file.deleted",
      "agent.completed",
      "agent.failed",
      "notification.created",
    ];
    for (const ev of namedEvents) {
      es.addEventListener(ev, (msg: any) => {
        try {
          const parsed = JSON.parse(msg.data);
          if (parsed.id) lastEventId = parsed.id;
          onEvent(parsed);
        } catch {}
      });
    }

    es.onerror = (err) => {
      onError?.(err);
      es?.close();
      if (!closed) {
        setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 10000);
      }
    };
  }

  connect();

  return () => {
    closed = true;
    es?.close();
  };
}

async function fetchStream(url: string, onEvent: (e: CumseeEvent) => void) {
  const token = (() => { try { return localStorage.getItem("cumsee_token") || localStorage.getItem("token"); } catch { return null; } })();
  const headers: any = { Accept: "text/event-stream" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers, credentials: "include" });
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const lines = part.split("\n");
      let data = "";
      for (const line of lines) {
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) {
        try {
          const ev = JSON.parse(data);
          onEvent(ev);
        } catch {}
      }
    }
  }
}
