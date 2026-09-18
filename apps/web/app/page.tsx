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
    <div className="delvin-shell flex h-screen overflow-hidden">
      <SessionSidebar selectedId={sessionId || undefined} onSelect={setSessionId} onNew={createNewSession} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header with branding */}
        <header className="delvin-topbar flex items-center justify-between border-b border-[#e5e7eb] bg-[#fcfaf8]/95 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <img src={BRANDING.LOGO_PATH} alt="Delvin logo" className="h-7 w-7 rounded-md object-cover object-center ring-1 ring-[#39452a]" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            <h1 className="text-base font-semibold tracking-wide">{BRANDING.PRODUCT_NAME} Agent</h1>
            <span className="hidden rounded-full border border-[#263247] bg-[#111827] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#6f6862] sm:inline-flex">{BRANDING.PRODUCT_DOMAIN}</span>
            <span className={`rounded px-2 py-0.5 text-xs ${status === "running" ? "bg-[#ffc800] text-[#2e2b29]" : status === "completed" ? "bg-[#f0ebe5] text-[#2e2b29]" : status === "failed" ? "bg-[#ef4444] text-white" : "bg-[#f0ebe5] text-[#6f6862]"}`}>{status}</span>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector value={selectedModel} onChange={(m, p) => { setSelectedModel(m); setSelectedProvider(p); }} />
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Center */}
          <div className="delvin-main flex flex-1 flex-col overflow-hidden bg-[#fcfaf8]">
            <div className="flex-1 overflow-auto px-4 py-8 sm:px-8">
              <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end space-y-5">
                {!messages.length && <div className="delvin-welcome mb-auto flex flex-col items-center justify-center px-4 pb-10 pt-12 text-center">
                  <img src={BRANDING.LOGO_PATH} alt="Delvin logo" className="mb-5 h-16 w-16 rounded-2xl object-cover object-center shadow-[0_0_40px_rgba(106,227,255,0.14)] ring-1 ring-[#465a35]" />
                  <h2 className="text-3xl font-semibold tracking-wide text-[#2e2b29]">What are we building today?</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[#6f6862]">Ask Delvin to inspect, build, fix, or explain your project. Your workspace, terminal actions, and approvals stay visible in one place.</p>
                  {projectId && <div className="mt-5 rounded-full border border-[#202b3c] bg-[#0f1622] px-3 py-1.5 text-[11px] text-[#6f6862]">Workspace ready · {projectId.slice(0, 8)}…</div>}
                </div>}

                {error && <div className="rounded border border-[#e1dedb] bg-[#1d1313] p-3 text-sm text-[#b42318]">{error}</div>}

                {pendingTool && <ApprovalBar toolCall={pendingTool} onResolved={async () => {
                  if (sessionId) {
                    const t = await api.listToolCalls(sessionId);
                    setToolCalls(t.toolCalls || []);
                  }
                }} />}

                <MessageList messages={messages} />

                {loading && <div className="text-sm text-[#6f6862]">Sending…</div>}

                <div className="rounded-2xl border border-[#e1dedb] bg-white p-3 shadow-[0_16px_50px_rgba(0,0,0,0.14)]">
                  <h3 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6f6862]">Activity</h3>
                  <ToolTimeline events={events} />
                </div>

                {projectId && (
                  <div className="rounded border border-[#e5e7eb] bg-white p-3">
                    <h3 className="mb-2 text-xs font-semibold tracking-widest text-[#6f6862]">FILES</h3>
                    <FileViewer projectId={projectId} />
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#e5e7eb] bg-[#fcfaf8]/95 px-4 py-4 backdrop-blur sm:px-8">
              <div className="mx-auto max-w-3xl">
                <Composer onSend={sendMessage} disabled={loading} />
                {!sessionId && <div className="mt-2 text-xs text-[#f59e0b]">No session selected — sending will create one.</div>}
              </div>
            </div>
          </div>

          {/* Right panel: terminal + events */}
          <div className="hidden w-[340px] flex-col border-l border-[#e5e7eb] bg-[#f7f3ef] xl:flex">
            <div className="border-b border-[#e5e7eb] p-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6f6862]">Workspace terminal</h3>
              {sessionId ? <Terminal sessionId={sessionId} /> : <div className="text-xs text-[#6f6862]">Select a session to use terminal.</div>}
            </div>
            <div className="flex-1 overflow-auto p-3">
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6f6862]">Recent activity</h3>
              {toolCalls.length === 0 ? <div className="text-xs text-[#6f6862]">No tool calls yet.</div> : (
                <div className="space-y-2">
                  {toolCalls.slice(0, 10).map((t) => (
                    <div key={t.id} className="rounded border border-[#e5e7eb] bg-white p-2 text-xs">
                      <div className="font-mono">{t.toolName} • {t.riskLevel} • {t.approvalStatus} • {t.executionStatus}</div>
                      <div className="text-[#6f6862] truncate">{JSON.stringify(t.argumentsJson || t.arguments_json).slice(0, 200)}</div>
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
