"use client";
import { useEffect, useState } from "react";
import { BRANDING } from "../branding.config";
import { api } from "../lib/api";
import { connectSSE, CumseeEvent } from "../lib/sse";
import { SessionSidebar } from "../components/SessionSidebar";
import { ModelSelector } from "../components/ModelSelector";
import { Composer } from "../components/Composer";
import { MessageList } from "../components/MessageList";
import { ToolTimeline } from "../components/ToolTimeline";
import { Terminal } from "../components/Terminal";
import { ApprovalBar } from "../components/ApprovalBar";
import { FileViewer } from "../components/FileViewer";

export default function AgentPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [toolCalls, setToolCalls] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState("mock-gpt-4o");
  const [selectedProvider, setSelectedProvider] = useState("mock");
  const [status, setStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Create default project + session on mount if none
  useEffect(() => {
    (async () => {
      try {
        const p = await api.listProjects();
        if (p.projects.length === 0) {
          const created = await api.createProject({ name: "My First Project", defaultBranch: "main" });
          setProjectId(created.project.id);
        } else {
          setProjectId(p.projects[0].id);
        }
        const s = await api.listSessions();
        setSessions(s.sessions || []);
        if (s.sessions.length > 0) setSessionId(s.sessions[0].id);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  // Load messages + events when session changes
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const m = await api.listMessages(sessionId);
        setMessages(m.messages || []);
        const e = await api.listEvents(sessionId);
        setEvents(e.events || []);
        const t = await api.listToolCalls(sessionId);
        setToolCalls(t.toolCalls || []);
      } catch (e: any) {
        setError(e.message);
      }
    })();

    // SSE
    const disconnect = connectSSE(
      sessionId,
      (ev: CumseeEvent) => {
        setEvents((prev) => [...prev, ev]);
        // Update status based on event
        if (ev.eventType === "agent.started") setStatus("running");
        if (ev.eventType === "agent.thinking") setStatus("thinking");
        if (ev.eventType === "agent.completed") {
          setStatus("completed");
          // Browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`${BRANDING.PRODUCT_NAME}: Task completed`, { body: ev.payload?.title || "Agent finished" });
          }
          // Refresh messages
          api.listMessages(sessionId).then((m) => setMessages(m.messages || []));
        }
        if (ev.eventType === "agent.failed") setStatus("failed");
        if (ev.eventType.startsWith("tool.")) {
          api.listToolCalls(sessionId).then((t) => setToolCalls(t.toolCalls || []));
        }
        if (ev.eventType === "notification.created" && "Notification" in window) {
          if (Notification.permission === "granted") new Notification(ev.payload.title || "Notification", { body: ev.payload.body });
        }
      },
      (err) => console.warn("SSE error", err)
    );
    return () => disconnect();
  }, [sessionId]);

  // Notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  async function createNewSession() {
    try {
      const res = await api.createSession({ projectId: projectId || undefined, title: "New Session", selectedModel, selectedProvider });
      setSessionId(res.session.id);
      const s = await api.listSessions();
      setSessions(s.sessions || []);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function sendMessage(text: string) {
    if (!sessionId) {
      // Create session first
      const s = await api.createSession({ projectId: projectId || undefined, title: text.slice(0, 60), selectedModel, selectedProvider });
      setSessionId(s.session.id);
      await api.sendMessage(s.session.id, { role: "user", content: text, selectedModel, selectedProvider });
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: text, status: "completed", createdAt: new Date().toISOString() }]);
      setStatus("running");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.sendMessage(sessionId, { role: "user", content: text, selectedModel, selectedProvider });
      setMessages((prev) => [...prev, res.message]);
      setStatus("running");
      // Refresh after a bit
      setTimeout(async () => {
        const m = await api.listMessages(sessionId);
        setMessages(m.messages || []);
      }, 1000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const pendingTool = toolCalls.find((t) => t.approvalStatus === "pending");

  return (
    <div className="flex h-screen overflow-hidden">
      <SessionSidebar selectedId={sessionId || undefined} onSelect={setSessionId} onNew={createNewSession} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header with branding */}
        <header className="flex items-center justify-between border-b border-[#1e2433] bg-[#0b0e14] px-4 py-2">
          <div className="flex items-center gap-3">
            <img src={BRANDING.LOGO_PATH} alt="logo" className="h-6 w-6" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            <h1 className="text-sm font-semibold">{BRANDING.PRODUCT_NAME}</h1>
            <span className="rounded bg-[#1a2032] px-2 py-0.5 text-xs text-[#9aa0b2]">{BRANDING.PRODUCT_DOMAIN}</span>
            <span className={`rounded px-2 py-0.5 text-xs ${status === "running" ? "bg-[#f59e0b] text-black" : status === "completed" ? "bg-[#10b981] text-black" : status === "failed" ? "bg-[#ef4444] text-white" : "bg-[#1e2433] text-[#9aa0b2]"}`}>{status}</span>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector value={selectedModel} onChange={(m, p) => { setSelectedModel(m); setSelectedProvider(p); }} />
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Center */}
          <div className="flex flex-1 flex-col overflow-hidden bg-[#0b0e14]">
            <div className="flex-1 overflow-auto p-4">
              <div className="mx-auto max-w-3xl space-y-4">
                <div className="rounded-lg border border-[#1e2433] bg-[#0f131d] p-4 text-center">
                  <h2 className="text-lg font-semibold">Experience the frontier</h2>
                  <p className="text-sm text-[#9aa0b2]">Chat with {BRANDING.PRODUCT_NAME} and build through a secure VPS terminal. Sessions are persistent, messages are saved, approvals are required for risky actions.</p>
                  {projectId && <div className="mt-2 text-xs text-[#6b7280]">Project: {projectId.slice(0, 8)}… • Workspace: /tmp/cumsee-workspaces/{projectId.slice(0, 8)}</div>}
                </div>

                {error && <div className="rounded border border-[#3a1f1f] bg-[#1d1313] p-3 text-sm text-[#ffb4b4]">{error}</div>}

                {pendingTool && <ApprovalBar toolCall={pendingTool} onResolved={async () => {
                  if (sessionId) {
                    const t = await api.listToolCalls(sessionId);
                    setToolCalls(t.toolCalls || []);
                  }
                }} />}

                <MessageList messages={messages} />

                {loading && <div className="text-sm text-[#9aa0b2]">Sending…</div>}

                <div className="rounded border border-[#1e2433] bg-[#0f131d] p-3">
                  <h3 className="mb-2 text-xs font-semibold tracking-widest text-[#9aa0b2]">TOOL TIMELINE</h3>
                  <ToolTimeline events={events} />
                </div>

                {projectId && (
                  <div className="rounded border border-[#1e2433] bg-[#0f131d] p-3">
                    <h3 className="mb-2 text-xs font-semibold tracking-widest text-[#9aa0b2]">FILES</h3>
                    <FileViewer projectId={projectId} />
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#1e2433] bg-[#0b0e14] p-3">
              <div className="mx-auto max-w-3xl">
                <Composer onSend={sendMessage} disabled={loading || !sessionId} />
                {!sessionId && <div className="mt-2 text-xs text-[#f59e0b]">No session selected — sending will create one.</div>}
              </div>
            </div>
          </div>

          {/* Right panel: terminal + events */}
          <div className="hidden w-96 flex-col border-l border-[#1e2433] bg-[#0f131d] lg:flex">
            <div className="border-b border-[#1e2433] p-3">
              <h3 className="text-xs font-semibold tracking-widest text-[#9aa0b2]">TERMINAL</h3>
              {sessionId ? <Terminal sessionId={sessionId} /> : <div className="text-xs text-[#6b7280]">Select a session to use terminal.</div>}
            </div>
            <div className="flex-1 overflow-auto p-3">
              <h3 className="mb-2 text-xs font-semibold tracking-widest text-[#9aa0b2]">RECENT TOOL CALLS</h3>
              {toolCalls.length === 0 ? <div className="text-xs text-[#6b7280]">No tool calls yet.</div> : (
                <div className="space-y-2">
                  {toolCalls.slice(0, 10).map((t) => (
                    <div key={t.id} className="rounded border border-[#1e2433] bg-black p-2 text-xs">
                      <div className="font-mono">{t.toolName} • {t.riskLevel} • {t.approvalStatus} • {t.executionStatus}</div>
                      <div className="text-[#9aa0b2] truncate">{JSON.stringify(t.argumentsJson || t.arguments_json).slice(0, 200)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
