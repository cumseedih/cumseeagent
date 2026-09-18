"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { BRANDING } from "../branding.config";
import { Button, SkeletonRows, cx } from "./ui";
import { IconGithub, IconPlusChat, IconRefresh, IconSearch, IconSparkle, IconTrophy } from "./icons";
import { Mark, Wordmark } from "./Wordmark";

type Session = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  selectedModel?: string;
};

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
  project,
  onConnectRepository,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenSearch?: () => void;
  refreshKey?: number;
  project?: { id: string; name: string; defaultBranch?: string } | null;
  onConnectRepository?: () => void;
}) {
  const [promoOpen, setPromoOpen] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listSessions();
      setSessions(data.sessions || []);
    } catch (e: any) {
      setError(e.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (!query.trim()) return sessions;
    const q = query.toLowerCase();
    return sessions.filter((s) => (s.title || "").toLowerCase().includes(q));
  }, [sessions, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of filtered) {
      const key = bucketOf(s.updatedAt || s.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return ["Today", "Yesterday", "Previous 7 days", "Earlier"]
      .filter((k) => map.has(k))
      .map((k) => [k, map.get(k)!] as const);
  }, [filtered]);

  if (collapsed) {
    return (
      <nav className="flex h-full w-14 flex-col items-center gap-2 border-r border-sidebar-border bg-sidebar py-3">
        <button
          onClick={onToggleCollapse}
          title="Expand sidebar"
          className="grid h-8 w-8 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-sidebar-accent hover:text-interactive-active"
        >
          <Wordmark showName={false} glyphClass="h-5 w-5" />
        </button>
        <button
          onClick={onNew}
          title="New chat"
          className="grid h-8 w-8 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-sidebar-accent hover:text-interactive-active"
        >
          <IconPlusChat className="h-5 w-5" />
        </button>
        <button
          onClick={onOpenSearch}
          title="Search"
          className="grid h-8 w-8 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-sidebar-accent hover:text-interactive-active"
        >
          <IconSearch className="h-5 w-5" />
        </button>
      </nav>
    );
  }

  return (
    <nav className="flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand row */}
      <div className="flex h-14 items-center justify-between px-3">
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
        <SidebarLink icon={<IconPlusChat className="h-5 w-5" />} label="New Chat" onClick={onNew} />
        <SidebarLink
          icon={<IconSparkle className="h-5 w-5" />}
          label="Harnesses"
          onClick={() => onOpenSearch?.()}
          hint="Models & harnesses"
        />
        <SidebarLink icon={<IconTrophy className="h-5 w-5" />} label="Runs" hint="Session activity" onClick={load} />
        <SidebarLink icon={<IconSearch className="h-5 w-5" />} label="Search" onClick={onOpenSearch} />
      </div>

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
          groups.map(([label, items]) => (
            <div key={label} className="mb-2">
              <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
                {label}
              </div>
              {items.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={cx(
                    "group mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    selectedId === s.id
                      ? "bg-sidebar-accent text-text-primary"
                      : "text-text-tertiary hover:bg-sidebar-accent/70 hover:text-text-secondary"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{s.title || "Untitled session"}</span>
                    <span className="block truncate text-[11px] text-text-muted">
                      {s.status || "idle"}
                      {s.selectedModel ? ` · ${s.selectedModel}` : ""} ·{" "}
                      {new Date(s.updatedAt || s.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))}

        {!loading && !error && sessions.length > 0 && filtered.length === 0 && (
          <p className="px-2 py-3 text-xs text-text-muted">No sessions match “{query}”.</p>
        )}
      </div>

      {/* Connector promotion — mirrors the "connect your GitHub" card */}
      {promoOpen && (
        <div className="border-t border-sidebar-border p-2">
          <div className="rounded-panel border border-border-faint bg-surface-secondary p-2.5">
            <div className="mb-1.5 flex items-start gap-2">
              <span className="mt-[1px] text-text-tertiary">
                <IconGithub className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text-secondary">
                  {project ? project.name : "Connect your GitHub"}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-text-muted">
                  {project ? `${project.id.slice(0, 8)} · ${project.defaultBranch || "main"}` : "Clone and push from a session"}
                </p>
              </div>
              <button
                onClick={() => setPromoOpen(false)}
                aria-label="Dismiss connectors promotion"
                title="Dismiss"
                className="shrink-0 text-text-muted transition-colors hover:text-text-tertiary"
              >
                ×
              </button>
            </div>
            <Button variant="secondary" size="sm" className="w-full" onClick={onConnectRepository}>
              <IconGithub className="h-3.5 w-3.5" />
              {project ? "Manage repository" : "Connect"}
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <Mark className="h-7 w-7" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-text-secondary">{BRANDING.PRODUCT_NAME}</span>
            <span className="block truncate font-mono text-[10px] text-text-muted">{BRANDING.PRODUCT_DOMAIN}</span>
          </span>
          <Button variant="ghost" size="icon" onClick={load} title="Refresh sessions">
            <IconRefresh className="h-3.5 w-3.5" />
          </Button>
        </div>
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
