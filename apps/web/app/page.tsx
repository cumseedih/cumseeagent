"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BRANDING } from "../branding.config";
import { api } from "../lib/api";
import { connectSSE, CumseeEvent } from "../lib/sse";
import { SessionSidebar } from "../components/SessionSidebar";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { Composer } from "../components/Composer";
import { IconChevronDown, IconPanelLeft, IconFolder, IconGitBranch, IconSettings, IconGithub, IconX } from "../components/icons";
import { MessageList } from "../components/MessageList";
import { ToolTimeline } from "../components/ToolTimeline";
import { Terminal } from "../components/Terminal";
import { FileViewer } from "../components/FileViewer";
import { ApprovalBar } from "../components/ApprovalBar";
import { ErrorNote, cx } from "../components/ui";
import { TermsGate } from "../components/TermsGate";
import { WorkspaceSheet } from "../components/WorkspaceSheet";
import {
  BranchPicker,
  ConnectionsDialog,
  HarnessPicker,
  RepositoryPicker,
  type Harness,
} from "../components/Pickers";

type RailTab = "terminal" | "files" | "activity";

function AgentWorkspace() {
  const [project, setProject] = useState<{ id: string; name: string; defaultBranch?: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | undefined>();
  const [sessionsKey, setSessionsKey] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [events, setEvents] = useState<CumseeEvent[]>([]);
  const [toolCalls, setToolCalls] = useState<any[]>([]);
  const [harness, setHarness] = useState<Harness>("standard");
  const [quota, setQuota] = useState<{ remaining: number | null; limit: number; exhausted: boolean; unlimited: boolean } | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [repoPicker, setRepoPicker] = useState(false);
  const [branchPicker, setBranchPicker] = useState(false);
  const [harnessPicker, setHarnessPicker] = useState(false);
  const [connections, setConnections] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(false);
  const [branch, setBranch] = useState("main");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [githubPromoOpen, setGithubPromoOpen] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [railTab, setRailTab] = useState<RailTab>("activity");
  const [branches, setBranches] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
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

        api.getUsage().then(setQuota).catch(() => undefined);
        const s = await api.listSessions().catch(() => ({ sessions: [] as any[] }));
        if (s.sessions?.length) {
          setSessionId(s.sessions[0].id);
          setSessionTitle(s.sessions[0].title);
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
          api.getUsage().then(setQuota).catch(() => undefined);
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

      if (quota?.exhausted) {
        setError("Out of credits for today — the allowance resets at UTC midnight.");
        return;
      }

      const res = await api.sendMessage(target, {
        role: "user",
        content: payloadContent,
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
  const workspaceRefreshKey = events.filter((event) => event.eventType.startsWith("file.")).length;

  // Rendered in the transcript when a session is running, and above the
  // composer on the empty state — one definition, two mount points.
  const errorNote = error ? (
    <div className="mb-4">
      <ErrorNote onRetry={() => setError(null)}>{error}</ErrorNote>
    </div>
  ) : null;

  const approvalNote = pendingTool ? (
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
  ) : null;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-surface-primary">
      <TermsGate onAccepted={() => setTermsAccepted(true)} />
      <WorkspaceSheet open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} project={project} refreshKey={workspaceRefreshKey} />

      <RepositoryPicker
        open={repoPicker}
        onClose={() => setRepoPicker(false)}
        selectedId={project?.id}
        onSelect={(p) => {
          setProject(p as any);
          setBranch((p as any).defaultBranch || "main");
          setSelectedBranch(true);
          localStorage.setItem("delvin_project_id", p.id);
        }}
      />
      <BranchPicker
        open={branchPicker}
        onClose={() => setBranchPicker(false)}
        projectId={project?.id}
        current={branch}
        onSelect={(b) => {
          setBranch(b);
          setSelectedBranch(true);
        }}
      />
      <HarnessPicker
        open={harnessPicker}
        onClose={() => setHarnessPicker(false)}
        current={harness}
        onSelect={setHarness}
      />
      <ConnectionsDialog open={connections} onClose={() => setConnections(false)} projectId={project?.id} />

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
          onConnectRepository={() => setRepoPicker(true)}
          onOpenRepository={() => setRepoPicker(true)}
          onOpenConnections={() => setConnections(true)}
          onOpenHarness={() => setHarnessPicker(true)}
          onDeleted={(id) => {
            if (sessionId === id) {
              setSessionId(null);
              setSessionTitle(undefined);
              setMessages([]);
              setEvents([]);
              setToolCalls([]);
              setStatus("idle");
            }
            refreshSessions();
          }}
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
        {hasConversation ? <div className="shrink-0 animate-workspace-enter"><WorkspaceHeader
          status={status}
          project={project}
          branch={branch}
          harness={harness}
          onToggleSidebar={() => (isMobile ? setMobileNav((v) => !v) : setSidebarCollapsed((v) => !v))}
          onOpenRepository={() => setRepoPicker(true)}
          onOpenBranch={() => setBranchPicker(true)}
          onOpenHarness={() => setHarnessPicker(true)}
          onOpenWorkspace={() => setWorkspaceOpen(true)}
          quota={quota}
          railOpen={railOpen}
          onToggleRail={() => setRailOpen((v) => !v)}
          railTab={railTab}
          onRailTabChange={setRailTab}
          sessionTitle={sessionTitle}
        /></div> : <header className="flex h-[68px] shrink-0 items-center justify-between px-0 sm:px-5">
          <button aria-label="Open sessions" onClick={() => isMobile ? setMobileNav(v => !v) : setSidebarCollapsed(v => !v)} className="grid h-11 w-11 place-items-center rounded-lg text-text-primary hover:bg-surface-raised md:invisible"><IconPanelLeft className="h-[22px] w-[22px]" /></button>
          <button aria-label="Open workspace files" onClick={() => setWorkspaceOpen(true)} className="grid h-11 w-11 place-items-center rounded-lg text-text-placeholder hover:bg-surface-raised"><IconFolder className="h-[23px] w-[23px]" /></button>
        </header>}

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
            {hasConversation && (
              <div className="animate-workspace-enter min-h-0 flex-1 overflow-y-auto px-4">
                <div className="mx-auto w-full max-w-3xl py-6">
                  {errorNote}
                  {approvalNote}
                  <MessageList messages={messages} events={events} thinking={status === "thinking"} streaming={status === "running"} />
                </div>
              </div>
            )}

            {/* Bottom-docked composer; the empty-state headline occupies the open canvas. */}
            <div
              className={cx(
                "shrink-0",
                hasConversation
                  ? "px-4 pb-4 pt-2"
                  : "relative flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-4 pb-7 pt-4 md:justify-center md:pb-0 md:pt-0"
              )}
            >
              {!hasConversation && (
                <div className="pointer-events-none absolute inset-x-5 top-[42%] -translate-y-1/2 md:hidden">
                  <h1 className="animate-hero-breathe mx-auto max-w-[360px] text-center font-serif-display text-[48px] font-light leading-[0.98] tracking-[-0.055em] text-text-tertiary">
                    What would you like to do?
                  </h1>
                </div>
              )}
              <div className="relative mx-auto w-full max-w-[720px]">
                {!hasConversation && (
                  <div className="pointer-events-none absolute bottom-full left-0 right-0 hidden flex-col items-center pb-6 md:flex">
                    <h1 className="font-serif-display animate-rise text-center text-[48px] font-light leading-[1.02] tracking-[-0.055em] text-text-tertiary md:text-[54px]">
                      What would you like to do?
                    </h1>
                  </div>
                )}

                {!hasConversation && errorNote}
                {!hasConversation && approvalNote}
                {!hasConversation && (
                  <div className="mb-3 flex w-full gap-2 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {[
                      ["D", "Docs", "#4285F4"],
                      ["N", "Notion", "#2E3A2F"],
                      ["M", "Gmail", "#C96F4F"],
                      ["L", "Linear", "#6B7F5B"],
                      ["31", "Calendar", "#4285F4"],
                    ].map(([icon, label, color]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setConnections(true)}
                        className="flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-border-faint bg-surface-secondary px-3 text-[14px] text-text-secondary transition-colors hover:bg-surface-raised-tertiary"
                      >
                        <span className="grid h-5 min-w-5 place-items-center text-[12px] font-semibold" style={{ color }} aria-hidden="true">{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <Composer
                  onSend={sendMessage}
                  busy={busy}
                  onStop={stopRun}
                  disabled={sending}
                  placeholder="Ask anything…"
                  footer={hasConversation ? <div className="flex items-center gap-1.5 border-t border-border-faint p-1 sm:gap-2 sm:p-2 md:hidden">
                    <button onClick={() => setRepoPicker(true)} className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-faint px-2 text-[12px] text-text-tertiary hover:bg-surface-raised-tertiary sm:h-10 sm:px-3 sm:text-[13px]"><IconFolder className="h-4 w-4 shrink-0 sm:h-[17px] sm:w-[17px]" /><span className="truncate">{project?.name || "Add repositories…"}</span><IconChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-text-muted sm:h-4 sm:w-4" /></button>
                    <button onClick={() => setBranchPicker(true)} className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-faint px-2 text-[12px] text-text-tertiary hover:bg-surface-raised-tertiary sm:h-10 sm:px-3 sm:text-[13px]"><IconGitBranch className="h-4 w-4 shrink-0 sm:h-[17px] sm:w-[17px]" /><span className="truncate">{branch || "main"}</span><IconChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-text-muted sm:h-4 sm:w-4" /></button>
                    <button aria-label="Connection settings" onClick={() => setConnections(true)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-tertiary hover:bg-surface-raised sm:h-10 sm:w-10"><IconSettings className="h-[18px] w-[18px] sm:h-5 sm:w-5" /></button>
                  </div> : undefined}
                />
                {!hasConversation && githubPromoOpen && (
                  <div className="mt-3 flex h-[38px] w-full items-center justify-between rounded-[8px] border border-border-medium bg-surface-tertiary px-2.5 text-sm text-text-secondary shadow-[0_1px_1px_rgba(46,58,47,0.03)] md:mt-3">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <IconGithub className="h-4 w-4 shrink-0 text-text-primary" />
                      <span className="truncate">Connect your GitHub</span>
                      <span className="rounded-[4px] border border-border-strong px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-interactive-link">
                        New
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConnections(true)}
                        className="h-6 rounded-[4px] bg-primary px-2.5 text-xs font-medium text-white transition-colors hover:bg-interactive-active"
                      >
                        Connect
                      </button>
                      <button
                        type="button"
                        aria-label="Dismiss GitHub promotion"
                        onClick={() => setGithubPromoOpen(false)}
                        className="grid h-6 w-6 place-items-center rounded-[4px] bg-surface-raised-tertiary text-text-muted transition-colors hover:text-text-primary"
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                {/* Transcript metadata remains hidden on the minimal landing screen. */}
                <div
                  className={cx(
                    "mt-2 items-center justify-between px-1 text-[10px] text-text-muted",
                    hasConversation ? "flex" : "hidden"
                  )}
                >
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
            <aside className="hidden w-[380px] shrink-0 flex-col border-l border-border-faint bg-surface-primary lg:flex">
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
                  <FileViewer projectId={project.id} refreshKey={workspaceRefreshKey} />
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

type AuthStatus = "checking" | "authenticated" | "anonymous";

export default function AgentPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAuthError(params.get("auth_error"));
    api.me()
      .then(() => setAuthStatus("authenticated"))
      .catch(() => setAuthStatus("anonymous"));
  }, []);

  if (authStatus === "checking") {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-surface-primary">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border-medium border-t-interactive-cta" aria-label="Loading" />
      </main>
    );
  }

  if (authStatus === "anonymous") {
    return (
      <main className="relative grid min-h-[100dvh] overflow-hidden bg-surface-primary px-5 py-10 sm:px-8">
        <div className="pointer-events-none absolute -left-24 top-[-8rem] h-80 w-80 rounded-full bg-highlight/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />

        <section className="relative m-auto w-full max-w-[420px] animate-stage-in rounded-[28px] border border-border-faint bg-surface-floating/95 p-7 shadow-floating backdrop-blur sm:p-9">
          <div className="mb-10 flex items-center gap-3">
            <img src={BRANDING.LOGO_PATH} alt="Delvin" className="h-11 w-11 rounded-full object-cover ring-1 ring-border-faint" />
            <div>
              <p className="delvin-wordmark delvin-wordmark--login text-[26px]" aria-label="Delvin">
                <span className="delvin-wordmark__text">Delvin</span>
              </p>
              <p className="mt-1 text-xs text-text-muted">Your coding agent</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] text-text-primary">
              Build something great.
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-text-tertiary">
              Sign in to connect repositories, keep your workspaces, and continue your agent sessions.
            </p>
          </div>

          {authError && (
            <div role="alert" className="mb-4 rounded-xl border border-interactive-negative/20 bg-interactive-negative/5 px-3.5 py-3 text-sm text-interactive-negative">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={() => window.location.assign("/api/auth/google")}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-interactive-cta px-4 text-[15px] font-semibold text-interactive-on-cta shadow-sm transition hover:bg-interactive-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-link focus-visible:ring-offset-2"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 rounded-full bg-white p-0.5">
              <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.23-.2-1.77H12v3.41h5.52a4.72 4.72 0 0 1-2.05 3.01l-.02.11 2.98 2.31.21.02c1.92-1.77 2.96-4.38 2.96-7.09Z" />
              <path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.62-2.42l-3.15-2.44c-.84.57-1.96.97-3.47.97a6.02 6.02 0 0 1-5.7-4.16l-.11.01-3.1 2.4-.04.1A10 10 0 0 0 12 22Z" />
              <path fill="#FBBC05" d="M6.3 13.95A6.15 6.15 0 0 1 5.98 12c0-.68.12-1.34.31-1.95v-.12L3.16 7.49l-.1.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.46l3.25-2.51Z" />
              <path fill="#EA4335" d="M12 5.89c1.88 0 3.15.81 3.88 1.48l2.81-2.74C16.97 3.03 14.7 2 12 2a10 10 0 0 0-8.95 5.54l3.24 2.51A6.04 6.04 0 0 1 12 5.89Z" />
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-[11px] leading-5 text-text-muted">
            By continuing, you agree to Delvin&apos;s Terms of Use and Privacy Policy.
          </p>
        </section>
      </main>
    );
  }

  return <AgentWorkspace />;
}
