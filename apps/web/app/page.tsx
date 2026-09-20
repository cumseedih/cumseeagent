"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BRANDING } from "../branding.config";
import { api } from "../lib/api";
import { connectSSE, CumseeEvent } from "../lib/sse";
import { SessionSidebar } from "../components/SessionSidebar";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { Composer } from "../components/Composer";
import { IconChevronDown, IconPanelLeft, IconFolder, IconGitBranch, IconSettings } from "../components/icons";
import { MessageList } from "../components/MessageList";
import { ToolTimeline } from "../components/ToolTimeline";
import { Terminal } from "../components/Terminal";
import { FileViewer } from "../components/FileViewer";
import { ApprovalBar } from "../components/ApprovalBar";
import { ErrorNote, cx } from "../components/ui";
import { TermsGate } from "../components/TermsGate";
import {
  BranchPicker,
  ConnectionsDialog,
  HarnessPicker,
  LeaderboardDialog,
  RepositoryPicker,
  type Harness,
} from "../components/Pickers";

type RailTab = "terminal" | "files" | "activity";

export default function AgentPage() {
  const [project, setProject] = useState<{ id: string; name: string; defaultBranch?: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | undefined>();
  const [sessionsKey, setSessionsKey] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [events, setEvents] = useState<CumseeEvent[]>([]);
  const [toolCalls, setToolCalls] = useState<any[]>([]);
  const [harness, setHarness] = useState<Harness>("standard");
  const [models, setModels] = useState<any[]>([]);
  const [quota, setQuota] = useState<{ remaining: number | null; limit: number; exhausted: boolean; unlimited: boolean } | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [repoPicker, setRepoPicker] = useState(false);
  const [branchPicker, setBranchPicker] = useState(false);
  const [harnessPicker, setHarnessPicker] = useState(false);
  const [connections, setConnections] = useState(false);
  const [leaderboard, setLeaderboard] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(false);
  const [branch, setBranch] = useState("main");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
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

        api.getUsage().then(setQuota).catch(() => undefined);
        api.listModels().then((m: any) => setModels(m.models || [])).catch(() => undefined);

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

  const [sessionList, setSessionList] = useState<any[]>([]);
  useEffect(() => {
    api.listSessions().then((d: any) => setSessionList(d.sessions || [])).catch(() => undefined);
  }, [sessionsKey]);

  const pendingTool = useMemo(() => toolCalls.find((t) => t.approvalStatus === "pending"), [toolCalls]);
  const busy = status === "running" || status === "thinking";
  const hasConversation = messages.length > 0;

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
      <LeaderboardDialog
        open={leaderboard}
        onClose={() => setLeaderboard(false)}
        sessions={sessionList}
        models={models}
      />

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
          onOpenLeaderboard={() => setLeaderboard(true)}
          onOpenConnections={() => setConnections(true)}
          onOpenHarness={() => setHarnessPicker(true)}
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
        {hasConversation ? <WorkspaceHeader
          status={status}
          project={project}
          branch={branch}
          harness={harness}
          onToggleSidebar={() => (isMobile ? setMobileNav((v) => !v) : setSidebarCollapsed((v) => !v))}
          onOpenRepository={() => setRepoPicker(true)}
          onOpenBranch={() => setBranchPicker(true)}
          onOpenHarness={() => setHarnessPicker(true)}
          quota={quota}
          railOpen={railOpen}
          onToggleRail={() => setRailOpen((v) => !v)}
          railTab={railTab}
          onRailTabChange={setRailTab}
          sessionTitle={sessionTitle}
        /> : <header className="flex h-[68px] shrink-0 items-center justify-between px-0 sm:px-5">
          <button aria-label="Open sessions" onClick={() => isMobile ? setMobileNav(v => !v) : setSidebarCollapsed(v => !v)} className="grid h-11 w-11 place-items-center rounded-lg text-text-primary hover:bg-surface-raised"><IconPanelLeft className="h-[22px] w-[22px]" /></button>
          <button aria-label="Open repositories" onClick={() => setRepoPicker(true)} className="grid h-11 w-11 place-items-center rounded-lg text-text-placeholder hover:bg-surface-raised"><IconFolder className="h-[23px] w-[23px]" /></button>
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
              <div className="min-h-0 flex-1 overflow-y-auto px-4">
                <div className="mx-auto w-full max-w-3xl py-6">
                  {errorNote}
                  {approvalNote}
                  <MessageList messages={messages} thinking={status === "thinking"} streaming={status === "running"} />
                </div>
              </div>
            )}

            {/* Bottom-docked composer; the empty-state headline occupies the open canvas. */}
            <div
              className={cx(
                "shrink-0",
                hasConversation
                  ? "px-4 pb-4 pt-2"
                  : "relative flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-4 pb-7 pt-4"
              )}
            >
              {!hasConversation && <div className="pointer-events-none absolute inset-x-3 top-[40%] -translate-y-1/2"><h1 className="whitespace-nowrap text-center font-serif-display text-[28px] font-light leading-[1.08] tracking-[-0.045em] text-text-tertiary sm:text-[clamp(34px,4vw,48px)]">What would you like to do?</h1></div>}
              <div className="relative mx-auto w-full max-w-2xl">

                {!hasConversation && errorNote}
                {!hasConversation && approvalNote}
                <Composer
                  onSend={sendMessage}
                  busy={busy}
                  onStop={stopRun}
                  disabled={sending}
                  placeholder="Ask anything…"
                  footer={<div className="flex items-center gap-1.5 border-t border-border-faint p-1 sm:gap-2 sm:p-2">
                    <button onClick={() => setRepoPicker(true)} className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-faint px-2 text-[12px] text-text-tertiary hover:bg-surface-raised-tertiary sm:h-10 sm:px-3 sm:text-[13px]"><IconFolder className="h-4 w-4 shrink-0 sm:h-[17px] sm:w-[17px]" /><span className="truncate">{project?.name || "Add repositories…"}</span><IconChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-text-muted sm:h-4 sm:w-4" /></button>
                    <button onClick={() => setBranchPicker(true)} className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-faint px-2 text-[12px] text-text-tertiary hover:bg-surface-raised-tertiary sm:h-10 sm:px-3 sm:text-[13px]"><IconGitBranch className="h-4 w-4 shrink-0 sm:h-[17px] sm:w-[17px]" /><span className="truncate">{branch || "main"}</span><IconChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-text-muted sm:h-4 sm:w-4" /></button>
                    <button aria-label="Connection settings" onClick={() => setConnections(true)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-tertiary hover:bg-surface-raised sm:h-10 sm:w-10"><IconSettings className="h-[18px] w-[18px] sm:h-5 sm:w-5" /></button>
                  </div>}
                />
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
