"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BRANDING } from "../branding.config";
import { api } from "../lib/api";
import { connectSSE, CumseeEvent } from "../lib/sse";
import { SessionSidebar } from "../components/SessionSidebar";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { Hero } from "../components/Hero";
import { Composer } from "../components/Composer";
import { MessageList } from "../components/MessageList";
import { ToolTimeline } from "../components/ToolTimeline";
import { Terminal } from "../components/Terminal";
import { FileViewer } from "../components/FileViewer";
import { ApprovalBar } from "../components/ApprovalBar";
import { ErrorNote, Skeleton, cx } from "../components/ui";

type RailTab = "terminal" | "files" | "activity";

export default function AgentPage() {
  const [project, setProject] = useState<{ id: string; name: string; defaultBranch?: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | undefined>();
  const [sessionsKey, setSessionsKey] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [events, setEvents] = useState<CumseeEvent[]>([]);
  const [toolCalls, setToolCalls] = useState<any[]>([]);
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState("");
  const [harness, setHarness] = useState("standard");
  const [branch, setBranch] = useState("main");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [railTab, setRailTab] = useState<RailTab>("activity");
  const [branches, setBranches] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const bootRef = useRef(false);

  /* ---------------------------------------------------------------- bootstrap */
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    (async () => {
      try {
        const projects = await api.listProjects().catch(() => ({ projects: [] as any[] }));
        let active = projects.projects?.[0];
        if (!active) {
          const created = await api.createProject({ name: "Workspace", defaultBranch: "main" });
          active = created.project;
        }
        setProject(active);
        setBranch(active?.defaultBranch || "main");

        // git branches, when a remote exists
        api
          .gitStatus(active.id)
          .then((s: any) => {
            const list: string[] = s?.branches || s?.status?.branches || [];
            if (Array.isArray(list) && list.length) setBranches(list);
            if (s?.branch) setBranch(s.branch);
          })
          .catch(() => undefined);

        const s = await api.listSessions().catch(() => ({ sessions: [] as any[] }));
        if (s.sessions?.length) {
          setSessionId(s.sessions[0].id);
          setSessionTitle(s.sessions[0].title);
          if (s.sessions[0].selectedModel) setModel(s.sessions[0].selectedModel);
        }
      } catch (e: any) {
        setBootError(e.message || "Backend unreachable");
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  /* --------------------------------------------------- session data + stream */
  useEffect(() => {
    if (!sessionId) return;
    let alive = true;

    (async () => {
      try {
        const [m, e, t] = await Promise.all([
          api.listMessages(sessionId),
          api.listEvents(sessionId),
          api.listToolCalls(sessionId),
        ]);
        if (!alive) return;
        setMessages(m.messages || []);
        setEvents(e.events || []);
        setToolCalls(t.toolCalls || []);
      } catch (e: any) {
        if (alive) setError(e.message || "Failed to load session");
      }
    })();

    const disconnect = connectSSE(
      sessionId,
      (ev) => {
        setEvents((prev) => [...prev.slice(-400), ev]);
        const type = ev.eventType;
        if (type === "agent.started") setStatus("running");
        if (type === "agent.thinking") setStatus("thinking");
        if (type === "agent.completed") {
          setStatus("completed");
          api.listMessages(sessionId).then((m) => setMessages(m.messages || []));
          api.listToolCalls(sessionId).then((t) => setToolCalls(t.toolCalls || []));
        }
        if (type === "agent.failed") setStatus("failed");
        if (type.startsWith("tool.") || type.startsWith("file.")) {
          api.listToolCalls(sessionId).then((t) => setToolCalls(t.toolCalls || []));
          if (type === "tool.requested") setStatus("waiting");
        }
        if (type === "notification.created" && typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification(ev.payload?.title || BRANDING.PRODUCT_NAME, { body: ev.payload?.body });
          }
        }
      },
      (err) => console.warn("SSE error", err)
    );

    return () => {
      alive = false;
      disconnect();
    };
  }, [sessionId]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      // defer so it never blocks first paint
      const t = setTimeout(() => Notification.requestPermission().catch(() => undefined), 2500);
      return () => clearTimeout(t);
    }
  }, []);

  /* viewport: below md the sidebar becomes an overlay drawer */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      setIsMobile(mq.matches);
      if (!mq.matches) setMobileNav(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* ----------------------------------------------------------------- actions */
  const refreshSessions = useCallback(() => setSessionsKey((k) => k + 1), []);

  async function createSession(title?: string) {
    try {
      const res = await api.createSession({
        projectId: project?.id,
        title: title || "New session",
        selectedModel: model || undefined,
        selectedProvider: provider || undefined,
      });
      setSessionId(res.session.id);
      setSessionTitle(res.session.title);
      setMessages([]);
      setEvents([]);
      setToolCalls([]);
      setStatus("idle");
      setError(null);
      refreshSessions();
      return res.session.id as string;
    } catch (e: any) {
      setError(e.message || "Could not create session");
      return null;
    }
  }

  async function sendMessage(text: string, files: { name: string; size: number; content: string }[]) {
    setSending(true);
    setError(null);
    const payloadContent = files.length
      ? `${text}\n\n${files
          .map((f) => `Attached file: ${f.name}\n\`\`\`\n${f.content}\n\`\`\``)
          .join("\n\n")}`
      : text;
    try {
      let target = sessionId;
      if (!target) target = await createSession(text.slice(0, 60));
      if (!target) return;

      const res = await api.sendMessage(target, {
        role: "user",
        content: payloadContent,
        selectedModel: model || undefined,
        selectedProvider: provider || undefined,
      });
      setMessages((prev) => [...prev, res.message || { id: `local-${Date.now()}`, role: "user", content: payloadContent, status: "completed", createdAt: new Date().toISOString() }]);
      setStatus("running");
      refreshSessions();
    } catch (e: any) {
      setError(e.message || "Message failed to send");
    } finally {
      setSending(false);
    }
  }

  const stopRun = useCallback(async () => {
    if (!sessionId) return;
    try {
      await api.stopSession(sessionId);
      setStatus("idle");
      setToast("Run stopped");
      setTimeout(() => setToast(null), 2200);
    } catch (e: any) {
      setError(e.message || "Could not stop run");
    }
  }, [sessionId]);

  async function connectRepository() {
    if (!project) return;
    try {
      const s: any = await api.gitStatus(project.id);
      setToast(s?.remote ? `Remote: ${s.remote}` : "No git remote configured — set one on the server to push");
    } catch (e: any) {
      setToast(e.message || "Git status unavailable");
    }
    setTimeout(() => setToast(null), 3200);
  }

  const pendingTool = useMemo(() => toolCalls.find((t) => t.approvalStatus === "pending"), [toolCalls]);
  const busy = status === "running" || status === "thinking";
  const hasConversation = messages.length > 0;

  return (
    <div className="flex h-screen overflow-hidden bg-surface-primary">
      {/* Mobile: dim backdrop behind the drawer */}
      {isMobile && mobileNav && (
        <div
          className="fixed inset-0 z-40 animate-fade bg-black/60 md:hidden"
          onClick={() => setMobileNav(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={cx(
          "h-full shrink-0",
          isMobile
            ? cx("fixed inset-y-0 left-0 z-50 transition-transform duration-200", mobileNav ? "translate-x-0" : "-translate-x-full")
            : "flex"
        )}
      >
        <SessionSidebar
          project={project}
          onConnectRepository={connectRepository}
          selectedId={sessionId || undefined}
          onSelect={(id) => {
            setSessionId(id);
            setSessionTitle(undefined);
            setStatus("idle");
            if (isMobile) setMobileNav(false);
          }}
          onNew={() => {
            createSession();
            if (isMobile) setMobileNav(false);
          }}
          collapsed={isMobile ? false : sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onOpenSearch={() => (isMobile ? setMobileNav(true) : setSidebarCollapsed(false))}
          refreshKey={sessionsKey}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceHeader
          status={status}
          project={project}
          branch={branch}
          branches={branches}
          onBranchChange={setBranch}
          model={model}
          providerId={provider}
          harness={harness}
          onHarnessChange={setHarness}
          onModelChange={(m, p) => {
            setModel(m);
            setProvider(p);
          }}
          onToggleSidebar={() => (isMobile ? setMobileNav((v) => !v) : setSidebarCollapsed((v) => !v))}
          railOpen={railOpen}
          onToggleRail={() => setRailOpen((v) => !v)}
          railTab={railTab}
          onRailTabChange={setRailTab}
          sessionTitle={sessionTitle}
        />

        {bootError && (
          <div className="px-4 pt-3">
            <ErrorNote onRetry={() => location.reload()}>
              Backend unreachable — {bootError}. Check the API service and <code className="font-mono">/api/health</code>.
            </ErrorNote>
          </div>
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Conversation column */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              <div className={cx("mx-auto w-full", hasConversation ? "max-w-3xl py-6" : "flex min-h-full max-w-3xl flex-col justify-center py-10")}>
                {booting && !hasConversation && (
                  <div className="w-full max-w-xl space-y-3 self-center">
                    <Skeleton className="mx-auto h-12 w-12 rounded-full" />
                    <Skeleton className="mx-auto h-8 w-3/5" />
                    <Skeleton className="mx-auto h-3 w-1/3" />
                    <Skeleton className="mt-6 h-24 w-full rounded-composer" />
                  </div>
                )}

                {!booting && !hasConversation && <Hero busy={sending} />}

                {error && (
                  <div className="mb-4">
                    <ErrorNote onRetry={() => setError(null)}>{error}</ErrorNote>
                  </div>
                )}

                {pendingTool && (
                  <div className="mb-4">
                    <ApprovalBar
                      toolCall={pendingTool}
                      onResolved={async () => {
                        if (sessionId) {
                          const t = await api.listToolCalls(sessionId).catch(() => null);
                          if (t) setToolCalls(t.toolCalls || []);
                        }
                      }}
                    />
                  </div>
                )}

                {hasConversation && (
                  <MessageList messages={messages} thinking={status === "thinking"} streaming={status === "running"} />
                )}
              </div>
            </div>

            {/* Composer dock */}
            <div className="shrink-0 px-4 pb-4 pt-2">
              <div className="mx-auto w-full max-w-3xl">
                <Composer
                  onSend={sendMessage}
                  busy={busy}
                  onStop={stopRun}
                  disabled={sending}
                  placeholder={
                    project
                      ? `Describe the task for ${project.name} — attach files with the paperclip…`
                      : "Describe the task — or connect a repository first…"
                  }
                />
                <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-text-muted">
                  <span>
                    {BRANDING.PRODUCT_NAME} · {BRANDING.PRODUCT_DOMAIN}
                  </span>
                  <span className="flex items-center gap-2">
                    <span>Streaming over SSE</span>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline">Risky commands require approval</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right rail */}
          {railOpen && (
            <aside className="hidden w-[380px] shrink-0 flex-col border-l border-border-faint bg-surface-tertiary lg:flex">
              <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border-faint px-2">
                {(
                  [
                    ["activity", "Activity"],
                    ["terminal", "Terminal"],
                    ["files", "Files"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setRailTab(key)}
                    className={cx(
                      "h-6 rounded-xs px-2 text-[11px] uppercase tracking-[0.12em] transition-colors",
                      railTab === key
                        ? "bg-surface-raised text-interactive-active"
                        : "text-text-muted hover:text-text-tertiary"
                    )}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => setRailOpen(false)}
                  className="ml-auto rounded-xs px-1.5 py-1 text-text-muted hover:text-text-tertiary"
                  title="Hide panel"
                >
                  ×
                </button>
              </div>

              {railTab === "activity" && (
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  <ToolTimeline events={events} />
                  {toolCalls.length > 0 && (
                    <div className="mt-4 px-1.5">
                      <p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-text-muted">Tool calls</p>
                      <div className="space-y-1">
                        {toolCalls.slice(0, 12).map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-2 rounded-sm border border-border-faint bg-surface-primary/60 px-2 py-1.5 font-mono text-[11px]"
                          >
                            <span className="truncate text-text-secondary">{t.toolName}</span>
                            <span className="ml-auto shrink-0 text-text-muted">{t.riskLevel}</span>
                            <span
                              className={cx(
                                "shrink-0",
                                t.approvalStatus === "pending"
                                  ? "text-interactive-warning"
                                  : t.approvalStatus === "rejected"
                                    ? "text-interactive-negative"
                                    : "text-interactive-positive"
                              )}
                            >
                              {t.approvalStatus}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {railTab === "terminal" &&
                (sessionId ? (
                  <Terminal sessionId={sessionId} />
                ) : (
                  <p className="p-3 text-xs text-text-muted">Start a session to open the workspace terminal.</p>
                ))}

              {railTab === "files" &&
                (project ? (
                  <FileViewer projectId={project.id} />
                ) : (
                  <p className="p-3 text-xs text-text-muted">Connect a repository to browse workspace files.</p>
                ))}
            </aside>
          )}
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-slide-up rounded-panel border border-border-medium bg-surface-floating px-3.5 py-2 text-xs text-text-secondary shadow-floating">
          {toast}
        </div>
      )}
    </div>
  );
}
