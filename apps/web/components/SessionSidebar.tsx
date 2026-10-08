"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { BRANDING } from "../branding.config";
import { SkeletonRows, cx } from "./ui";
import { IconCheck, IconFile, IconFolder, IconPanelLeft, IconPencil, IconPlusChat, IconRefresh, IconSearch, IconSettings, IconShield, IconSparkle, IconTrash, IconX } from "./icons";
import { Wordmark } from "./Wordmark";
import type { WorkspaceSection } from "./WorkspaceHub";

type Session = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  isPinned?: boolean;
  agentProfileId?: string | null;
  groupChatId?: string | null;
  agentProfile?: { id: string; name: string } | null;
  groupChat?: { id: string; name: string } | null;
};
type SidebarAgent = { id: string; name: string; isDefault: boolean; isPinned: boolean };
type SidebarGroup = { id: string; name: string; isPinned: boolean; agents: Array<{ id: string; name: string }> };

/** Group sessions into Today / Yesterday / Previous 7 days / Earlier buckets. */
function bucketOf(iso: string) {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const day = 86_400_000;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  if (d >= startOfToday) return "Today";
  if (d >= startOfToday - day) return "Yesterday";
  if (d >= now - 7 * day) return "Previous 7 days";
  return "Earlier";
}

export function SessionSidebar({
  selectedId,
  onSelect,
  onNew,
  collapsed,
  onToggleCollapse,
  onOpenSearch,
  refreshKey,
  onDeleted,
  onRenamed,
  guest = false,
  user,
  onRequestLogin,
  onOpenAccount,
  activeSection = "chat",
  onSectionChange,
}: {
  selectedId?: string;
  onSelect: (id: string, association?: { agentProfileId?: string | null; groupChatId?: string | null }) => void;
  onNew: (agentProfileId?: string, groupChatId?: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenSearch?: () => void;
  refreshKey?: number;
  project?: { id: string; name: string; defaultBranch?: string } | null;
  onConnectRepository?: () => void;
  onOpenConnections?: () => void;
  onOpenRepository?: () => void;
  onOpenHarness?: () => void;
  onDeleted?: (id: string) => void;
  onRenamed?: (session: { id: string; title: string }) => void;
  guest?: boolean;
  user?: { email: string; displayName?: string | null; avatarUrl?: string | null } | null;
  onRequestLogin?: () => void;
  onOpenAccount?: () => void;
  activeSection?: WorkspaceSection;
  onSectionChange?: (section: WorkspaceSection) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [agents, setAgents] = useState<SidebarAgent[]>([]);
  const [groupChats, setGroupChats] = useState<SidebarGroup[]>([]);
  const [scope, setScope] = useState<{ type: "all" | "agent" | "group"; id?: string }>({ type: "all" });
  const [savingPinId, setSavingPinId] = useState<string | null>(null);
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }

  function startHold(id: string) {
    cancelHold();
    longPressed.current = false;
    holdTimer.current = setTimeout(() => {
      longPressed.current = true;
      setActionSessionId(id);
      navigator.vibrate?.(18);
    }, 560);
  }

  async function deleteSession(session: Session) {
    if (!window.confirm(`Delete “${session.title || "Untitled session"}”? This removes its chat history and cannot be undone.`)) return;
    setDeletingId(session.id);
    setError(null);
    try {
      await api.deleteSession(session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
      setActionSessionId(null);
      onDeleted?.(session.id);
    } catch (e: any) {
      setError(e.message || "Unable to delete session");
    } finally {
      setDeletingId(null);
    }
  }

  function startRename(session: Session) {
    setError(null);
    setEditingId(session.id);
    setTitleDraft(session.title || "Untitled session");
    setActionSessionId(null);
  }

  function cancelRename() {
    setEditingId(null);
    setTitleDraft("");
  }

  async function saveRename(session: Session) {
    const title = titleDraft.trim();
    if (!title) {
      setError("Give the session a name before saving.");
      return;
    }
    if (title === session.title) {
      cancelRename();
      return;
    }
    setSavingTitle(true);
    setError(null);
    try {
      const result = await api.updateSession(session.id, { title });
      const renamed = result.session as Session;
      setSessions((current) => current.map((item) => (item.id === session.id ? renamed : item)));
      onRenamed?.({ id: session.id, title: renamed.title });
      cancelRename();
    } catch (e: any) {
      setError(e.message || "Unable to rename session");
    } finally {
      setSavingTitle(false);
    }
  }

  async function togglePin(session: Session) {
    setSavingPinId(session.id); setError(null);
    try {
      const result = await api.updateSession(session.id, { isPinned: !session.isPinned });
      setSessions((current) => current.map((item) => item.id === session.id ? result.session as Session : item));
      setActionSessionId(null);
    } catch (e: any) { setError(e.message || "Unable to update pinned status"); }
    finally { setSavingPinId(null); }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [data, agentData, groupData]: any[] = await Promise.all([api.listSessions(), api.listAgents(), api.listGroups()]);
      setSessions(data.sessions || []);
      setAgents(agentData.agents || []);
      setGroupChats(groupData.groups || []);
    } catch (e: any) {
      setError(e.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (guest) {
      setSessions([]);
      setAgents([]);
      setGroupChats([]);
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, guest]);

  const filtered = useMemo(() => sessions.filter((session) => {
    if (scope.type === "agent" && session.agentProfileId !== scope.id) return false;
    if (scope.type === "group" && session.groupChatId !== scope.id) return false;
    return !query.trim() || (session.title || "").toLowerCase().includes(query.toLowerCase());
  }), [sessions, query, scope]);

  const groupedSessions = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of filtered) {
      const key = s.isPinned ? "Pinned" : bucketOf(s.updatedAt || s.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return ["Pinned", "Today", "Yesterday", "Previous 7 days", "Earlier"]
      .filter((k) => map.has(k))
      .map((k) => [k, map.get(k)!] as const);
  }, [filtered]);

  function startScopedChat() {
    if (scope.type === "agent") onNew(scope.id, undefined);
    else if (scope.type === "group") onNew(undefined, scope.id);
    else onNew();
  }

  if (collapsed) {
    return (
      <nav className="flex h-full w-14 flex-col items-center border-r border-sidebar-border bg-sidebar py-3">
        <button
          onClick={onToggleCollapse}
          title="Open sessions"
          className="grid h-8 w-8 place-items-center rounded-md text-text-primary transition-colors hover:bg-sidebar-accent hover:text-interactive-active"
        >
          <IconPanelLeft className="h-[20px] w-[20px]" />
        </button>
        <div className="mt-4 flex flex-col gap-1">
          {([
            ["projects", "Projects", <IconFolder key="projects" className="h-[18px] w-[18px]" />],
            ["agents", "Agents", <IconSparkle key="agents" className="h-[18px] w-[18px]" />],
            ["groups", "Group Chats", <IconPlusChat key="groups" className="h-[18px] w-[18px]" />],
            ["artifacts", "Artifacts", <IconFile key="artifacts" className="h-[18px] w-[18px]" />],
            ["skills", "Skills", <IconSparkle key="skills" className="h-[18px] w-[18px]" />],
            ["workflows", "Workflows", <IconShield key="workflows" className="h-[18px] w-[18px]" />],
            ["connections", "Integrations", <IconPlusChat key="connections" className="h-[18px] w-[18px]" />],
            ["settings", "Settings", <IconSettings key="settings" className="h-[18px] w-[18px]" />],
          ] as const).map(([section, label, icon]) => <button key={section} type="button" onClick={() => onSectionChange?.(section)} title={label} aria-label={label} className={cx("grid h-9 w-9 place-items-center rounded-lg transition-colors", activeSection === section ? "bg-sidebar-accent text-interactive-active" : "text-text-muted hover:bg-sidebar-accent hover:text-text-primary")}>{icon}</button>)}
        </div>
      </nav>
    );
  }

  return (
    <nav className="flex h-full w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand row */}
      <div className="flex h-12 items-center justify-between px-4">
        <Wordmark glyphClass="h-5 w-5" textClass="text-[12px]" />
        <button
          onClick={onToggleCollapse}
          title="Collapse sidebar"
          className="rounded-sm px-1.5 py-1 text-text-muted transition-colors hover:bg-sidebar-accent hover:text-interactive-active"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <path d="M9.5 4v16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Primary nav */}
      <div className="px-2">
        <SidebarLink icon={<IconPlusChat className="h-5 w-5" />} label="New Chat" onClick={guest ? onRequestLogin : startScopedChat} />
        <SidebarLink icon={<IconSearch className="h-5 w-5" />} label="Search" onClick={onOpenSearch} />
      </div>

      <div className="mt-2 px-2">
        <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">Workspace</div>
        {([
          ["projects", "Projects", <IconFolder key="projects" className="h-4 w-4" />],
          ["agents", "Agents", <IconSparkle key="agents" className="h-4 w-4" />],
          ["groups", "Group Chats", <IconPlusChat key="groups" className="h-4 w-4" />],
          ["artifacts", "Artifacts", <IconFile key="artifacts" className="h-4 w-4" />],
          ["skills", "Skills", <IconSparkle key="skills" className="h-4 w-4" />],
          ["workflows", "Workflows", <IconShield key="workflows" className="h-4 w-4" />],
          ["connections", "Integrations", <IconPlusChat key="connections" className="h-4 w-4" />],
          ["settings", "Settings", <IconSettings key="settings" className="h-4 w-4" />],
        ] as const).map(([section, label, icon]) => <button key={section} type="button" onClick={() => onSectionChange?.(section)} aria-current={activeSection === section ? "page" : undefined} className={cx("flex h-7 w-full items-center gap-2 rounded-md px-2 text-left transition-colors", activeSection === section ? "bg-sidebar-accent text-sidebar-foreground" : "text-text-tertiary hover:bg-sidebar-accent hover:text-sidebar-foreground")}><span className="shrink-0">{icon}</span><span className="truncate text-[12px]">{label}</span></button>)}
      </div>

      {!guest && <div className="mx-2 mt-2 max-h-[28dvh] overflow-y-auto border-y border-sidebar-border py-1.5">
        <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">Chats by Agent</div>
        <button type="button" onClick={() => { setScope({ type: "all" }); onSectionChange?.("chat"); }} className={cx("flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[11px]", scope.type === "all" ? "bg-sidebar-accent text-sidebar-foreground" : "text-text-muted hover:bg-sidebar-accent hover:text-sidebar-foreground")}><IconPlusChat className="h-3.5 w-3.5" /><span>All chats</span></button>
        {agents.map((agent) => <button key={agent.id} type="button" onClick={() => { setScope({ type: "agent", id: agent.id }); onSectionChange?.("chat"); }} className={cx("flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[11px]", scope.type === "agent" && scope.id === agent.id ? "bg-sidebar-accent text-sidebar-foreground" : "text-text-muted hover:bg-sidebar-accent hover:text-sidebar-foreground")}><IconSparkle className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate">{agent.name}</span>{agent.isDefault && <span className="text-[9px]">Default</span>}</button>)}
        {groupChats.length > 0 && <div className="mt-1 border-t border-sidebar-border pt-1"><div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">Group Chats</div>{groupChats.map((group) => <button key={group.id} type="button" onClick={() => { setScope({ type: "group", id: group.id }); onSectionChange?.("chat"); }} className={cx("flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[11px]", scope.type === "group" && scope.id === group.id ? "bg-sidebar-accent text-sidebar-foreground" : "text-text-muted hover:bg-sidebar-accent hover:text-sidebar-foreground")}><IconPlusChat className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate">{group.name}</span></button>)}</div>}
      </div>}
      {/* Session search */}
      <div className="mt-3 px-2">
        <div className="flex h-8 items-center gap-2 rounded-md border border-transparent bg-sidebar-accent/50 px-2 focus-within:border-border-medium">
          <IconSearch className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions"
            className="h-full w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-text-muted hover:text-text-tertiary" aria-label="Clear">
              ×
            </button>
          )}
        </div>
      </div>

      {/* Sessions */}
      <div className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
        {loading && <SkeletonRows rows={6} />}

        {!loading && error && (
          <div className="m-1 rounded-md border border-interactive-negative/30 bg-interactive-negative/[0.07] p-2 text-xs text-interactive-negative">
            <p>{error}</p>
            <button onClick={load} className="mt-1.5 inline-flex items-center gap-1 underline underline-offset-2">
              <IconRefresh className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <p className="px-2 py-3 text-xs leading-relaxed text-text-muted">
            No sessions yet — start one and it will be saved here.
          </p>
        )}

        {!loading &&
          !error &&
          groupedSessions.map(([label, items]) => (
            <div key={label} className="mb-2">
              <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
                {label}
              </div>
              {items.map((s) => {
                const actionsOpen = actionSessionId === s.id;
                const editing = editingId === s.id;
                return (
                  <div
                    key={s.id}
                    className={cx(
                      "group mb-0.5 flex items-stretch overflow-hidden rounded-md transition-colors",
                      selectedId === s.id
                        ? "bg-sidebar-accent text-text-primary"
                        : "text-text-tertiary hover:bg-sidebar-accent/70 hover:text-text-secondary"
                    )}
                  >
                    {editing ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1 px-1 py-1">
                        <input
                          autoFocus
                          value={titleDraft}
                          maxLength={200}
                          onChange={(event) => setTitleDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") { event.preventDefault(); void saveRename(s); }
                            if (event.key === "Escape") { event.preventDefault(); cancelRename(); }
                          }}
                          aria-label="Session name"
                          className="h-7 min-w-0 flex-1 rounded-md border border-border-strong bg-surface-secondary px-2 text-sm text-text-primary outline-none"
                        />
                        <button type="button" onClick={() => void saveRename(s)} disabled={savingTitle} aria-label="Save session name" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-interactive-positive hover:bg-interactive-positive/10 disabled:opacity-50"><IconCheck className="h-4 w-4" /></button>
                        <button type="button" onClick={cancelRename} disabled={savingTitle} aria-label="Cancel rename" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-muted hover:bg-sidebar-accent disabled:opacity-50"><IconX className="h-4 w-4" /></button>
                      </div>
                    ) : <button
                      type="button"
                      onPointerDown={() => startHold(s.id)}
                      onPointerUp={cancelHold}
                      onPointerCancel={cancelHold}
                      onPointerLeave={cancelHold}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        cancelHold();
                        setActionSessionId(s.id);
                      }}
                      onClick={() => {
                        if (longPressed.current) {
                          longPressed.current = false;
                          return;
                        }
                        setActionSessionId(null);
                        onSelect(s.id, { agentProfileId: s.agentProfileId, groupChatId: s.groupChatId });
                      }}
                      aria-label={`${s.title || "Untitled session"}. Hold for actions.`}
                      className="min-w-0 flex-1 select-none px-2 py-1.5 text-left touch-pan-y"
                    >
                      <span className="block truncate text-sm">{s.title || "Untitled session"}</span>
                      <span className="block truncate text-[11px] text-text-muted">
                        {s.groupChat?.name || s.agentProfile?.name ? `${s.groupChat?.name || s.agentProfile?.name} · ` : ""}{s.status || "idle"} ·{" "}
                        {new Date(s.updatedAt || s.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>}
                    {actionsOpen && (
                      <div className="animate-action-reveal flex shrink-0 border-l border-border-faint bg-sidebar-accent/50">
                        <button type="button" onClick={() => void togglePin(s)} disabled={savingPinId === s.id} className="inline-flex w-[56px] items-center justify-center text-[11px] font-semibold text-text-secondary transition-colors hover:bg-sidebar-accent disabled:opacity-50" aria-label={`${s.isPinned ? "Unpin" : "Pin"} ${s.title || "session"}`}>{savingPinId === s.id ? "…" : s.isPinned ? "Unpin" : "Pin"}</button>
                        <button type="button" onClick={() => startRename(s)} className="inline-flex w-[70px] items-center justify-center gap-1 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-sidebar-accent" aria-label={`Rename ${s.title || "session"}`}><IconPencil className="h-3.5 w-3.5" />Rename</button>
                        <button type="button" onClick={() => deleteSession(s)} disabled={deletingId === s.id} className="inline-flex w-[74px] items-center justify-center gap-1.5 border-l border-interactive-negative/15 bg-interactive-negative/[0.08] text-[11px] font-semibold text-interactive-negative transition-colors hover:bg-interactive-negative/[0.14] disabled:opacity-50" aria-label={`Delete ${s.title || "session"}`}><IconTrash className="h-3.5 w-3.5" />{deletingId === s.id ? "Deleting" : "Delete"}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

        {!loading && !error && sessions.length > 0 && filtered.length === 0 && (
          <p className="px-2 py-3 text-xs text-text-muted">No sessions match “{query}”.</p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={guest ? onRequestLogin : onOpenAccount}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
        >
          {user?.avatarUrl ? <img src={user.avatarUrl} alt="Profile" className="h-7 w-7 rounded-full object-cover" /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e8e6e1] text-[10px] font-medium text-[#2e2b29]">{guest ? "D" : (user?.displayName || user?.email || "U").slice(0, 1).toUpperCase()}</span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-text-secondary">{guest ? "Log In" : user?.displayName || user?.email || BRANDING.PRODUCT_NAME}</span>
            <span className="block truncate font-mono text-[10px] text-text-muted">{guest ? "Save your chats and workspaces" : BRANDING.PRODUCT_DOMAIN}</span>
          </span>
          {!guest && <span className="text-text-muted">···</span>}
        </button>
      </div>
    </nav>
  );
}

function SidebarLink({
  icon,
  label,
  onClick,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left text-text-tertiary transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate text-sm">{label}</span>
      {hint && <span className="ml-auto truncate text-[10px] text-text-muted group-hover:hidden">{hint}</span>}
    </button>
  );
}
