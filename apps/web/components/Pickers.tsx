"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Button, cx } from "./ui";
import { Dialog, DialogEmpty, DialogRow, DialogSearch, DialogSection, DialogSkeleton } from "./Dialog";
import { IconCheck, IconChevronRight, IconClock, IconGithub, IconGitBranch, IconPlusChat, IconSparkle, IconRefresh, IconX } from "./icons";

/* -------------------------------------------------------------------------- */
/* Repository picker                                                          */
/* -------------------------------------------------------------------------- */

type Project = { id: string; name: string; defaultBranch?: string; repositoryUrl?: string | null };
type GitHubRepository = { id: string; name: string; fullName: string; private: boolean; defaultBranch: string; owner: string };

export function RepositoryPicker({
  open,
  onClose,
  onSelect,
  selectedId,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (project: Project) => void;
  selectedId?: string;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [githubRepositories, setGithubRepositories] = useState<GitHubRepository[]>([]);
  const [githubConnected, setGithubConnected] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [data, status] = await Promise.all([api.listProjects(), api.githubStatus().catch(() => ({ connected: false }))]);
      setProjects(data.projects || []);
      setGithubConnected(Boolean(status.connected));
      if (status.connected) {
        const repositories = await api.githubRepositories();
        setGithubRepositories(repositories.repositories || []);
      } else {
        setGithubRepositories([]);
      }
    } catch (e: any) {
      setError(e.message || "Couldn't load your repositories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [projects, query]);

  async function addRepository(repositoryId: string) {
    setCreating(true);
    try {
      const created = await api.githubClone(repositoryId);
      setProjects((prev) => [created.project, ...prev]);
      onSelect(created.project);
      onClose();
    } catch (e: any) {
      setError(e.message || "Couldn't add a repository.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Select a repository"
      subtitle="Sessions run against an isolated workspace checkout."
      labelledBy="repo-picker-title"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="leading-relaxed">
            A repo won&apos;t appear if its owner hasn&apos;t installed the app or granted access.
          </span>
          <a
            href="https://github.com/settings/installations"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 whitespace-nowrap text-text-tertiary underline underline-offset-2 hover:text-interactive-active"
          >
            Manage repositories on GitHub
          </a>
        </div>
      }
    >
      <DialogSearch value={query} onChange={setQuery} placeholder="Search repositories…" />

      {loading && <DialogSkeleton rows={4} />}

      {!loading && error && (
        <div className="p-4 text-center">
          <p className="text-xs text-interactive-negative">{error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={load}>
            <IconRefresh className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {!loading && !error && (
        <>
          <button
            onClick={() => {
              if (!githubConnected) window.location.assign("/api/github/connect");
            }}
            disabled={creating}
            className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-raised/50 disabled:opacity-50"
          >
            <span className="shrink-0 text-text-muted">
              <IconPlusChat className="h-4 w-4" />
            </span>
            <span className="text-sm text-text-secondary">{githubConnected ? "Choose a repository below" : "Connect GitHub to add repositories…"}</span>
          </button>

          {githubConnected && githubRepositories.map((repo) => (
            <DialogRow
              key={repo.id}
              icon={<IconGithub className="h-4 w-4" />}
              title={repo.fullName}
              subtitle={`${repo.private ? "Private" : "Public"} · ${repo.defaultBranch}`}
              onClick={() => addRepository(repo.id)}
            />
          ))}

          {githubConnected && githubRepositories.length === 0 && <DialogEmpty>No GitHub repositories are available to this installation.</DialogEmpty>}

          {filtered.map((p) => (
            <DialogRow
              key={p.id}
              icon={<IconGithub className="h-4 w-4" />}
              title={p.name}
              subtitle={`${p.id.slice(0, 8)} · ${p.defaultBranch || "main"}`}
              active={selectedId === p.id}
              right={selectedId === p.id ? <IconCheck className="h-4 w-4 text-interactive-positive" /> : undefined}
              onClick={() => {
                onSelect(p);
                onClose();
              }}
            />
          ))}
        </>
      )}
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Branch picker                                                              */
/* -------------------------------------------------------------------------- */

export function BranchPicker({
  open,
  onClose,
  projectId,
  current,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  current: string;
  onSelect: (branch: string) => void;
}) {
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    if (!projectId) {
      setBranches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const s: any = await api.gitStatus(projectId);
      const list: string[] = s?.branches || s?.status?.branches || [];
      setBranches(Array.isArray(list) ? list : []);
      if (s?.branch && !list.includes(s.branch)) setBranches([s.branch, ...list]);
    } catch (e: any) {
      setError(e.message || "Branches failed — retry");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? branches.filter((b) => b.toLowerCase().includes(q)) : branches;
  }, [branches, query]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Branch"
      subtitle="Select a branch before starting a coding session."
      labelledBy="branch-picker-title"
      width="max-w-[440px]"
    >
      <DialogSearch value={query} onChange={setQuery} placeholder="Search branches…" />

      {loading && <DialogSkeleton rows={3} />}

      {!loading && error && (
        <div className="p-4 text-center">
          <p className="text-xs text-interactive-negative">{error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={load}>
            <IconRefresh className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {!loading && !error && branches.length === 0 && (
        <DialogEmpty>No branches yet — we&apos;ll create one when you start.</DialogEmpty>
      )}

      {!loading && !error && branches.length > 0 && filtered.length === 0 && <DialogEmpty>No branches found.</DialogEmpty>}

      {!loading &&
        !error &&
        filtered.map((b) => (
          <DialogRow
            key={b}
            icon={<IconGitBranch className="h-4 w-4" />}
            title={<span className="font-mono text-[13px]">{b}</span>}
            active={current === b}
            right={current === b ? <IconCheck className="h-4 w-4 text-interactive-positive" /> : undefined}
            onClick={() => {
              onSelect(b);
              onClose();
            }}
          />
        ))}
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Harness picker                                                             */
/* -------------------------------------------------------------------------- */

export type Harness = "standard" | "fast" | "testing";

const HARNESSES: { id: Harness; name: string; blurb: string }[] = [
  { id: "standard", name: "Standard harness", blurb: "Full plan → execute → verify loop with approval gates" },
  { id: "fast", name: "Fast harness", blurb: "Skips the planning pass for small, well-scoped tasks" },
  { id: "testing", name: "Harness for testing", blurb: "Mock provider only — no external calls, for smoke tests" },
];

export function HarnessPicker({
  open,
  onClose,
  current,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  current: Harness;
  onSelect: (h: Harness) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? HARNESSES.filter((h) => h.name.toLowerCase().includes(q) || h.blurb.toLowerCase().includes(q)) : HARNESSES;
  }, [query]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Harness"
      subtitle="How the agent plans, executes and verifies a run."
      labelledBy="harness-picker-title"
      width="max-w-[480px]"
    >
      <DialogSearch value={query} onChange={setQuery} placeholder="Search harnesses" />
      {filtered.length === 0 && <DialogEmpty>No harness found</DialogEmpty>}
      {filtered.map((h) => (
        <DialogRow
          key={h.id}
          icon={<IconSparkle className="h-4 w-4" />}
          title={h.name}
          subtitle={h.blurb}
          active={current === h.id}
          right={current === h.id ? <IconCheck className="h-4 w-4 text-interactive-positive" /> : undefined}
          onClick={() => {
            onSelect(h.id);
            onClose();
          }}
        />
      ))}
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Connections                                                                */
/* -------------------------------------------------------------------------- */

export function ConnectionsDialog({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId?: string;
}) {
  const [github, setGithub] = useState<"idle" | "connecting" | "connected" | "disconnecting">("idle");
  const [account, setAccount] = useState<string | null>(null);
  const [google, setGoogle] = useState<"idle" | "connecting" | "connected" | "disconnecting">("idle");
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    api.githubStatus()
      .then((s: any) => {
        if (alive) {
          setGithub(s?.connected ? "connected" : "idle");
          setAccount(s?.connection?.accountLogin || null);
        }
      })
      .catch(() => undefined);
    api.googleStatus()
      .then((s: any) => {
        if (alive) {
          setGoogle(s?.connected ? "connected" : "idle");
          setGoogleEmail(s?.email || null);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open, projectId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Connections"
      subtitle="Connect all your apps to give sessions access to your stack."
      labelledBy="connections-title"
    >
      <div className="p-3">
        <div className="rounded-panel border border-border-faint bg-surface-secondary p-3">
          <div className="flex items-center gap-3">
            <span className="text-text-tertiary">
              <IconGithub className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-secondary">GitHub</p>
              <p className="text-[11px] text-text-muted">
                {github === "connected"
                  ? `Connected${account ? ` as ${account}` : ""} — choose approved repositories to clone and push`
                  : "Connect GitHub to choose repositories for Delvin"}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={github === "connecting" || github === "disconnecting"}
              onClick={async () => {
                if (github !== "connected") {
                  setGithub("connecting");
                  window.location.assign("/api/github/connect");
                  return;
                }
                setGithub("disconnecting");
                try {
                  await api.githubDisconnect();
                  setGithub("idle");
                  setAccount(null);
                } catch {
                  setGithub("connected");
                }
              }}
            >
              {github === "connecting" ? "Connecting…" : github === "disconnecting" ? "Disconnecting…" : github === "connected" ? "Disconnect" : "Connect"}
            </Button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="rounded-panel border border-border-faint bg-surface-secondary p-3">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f8f6ee] text-xs font-semibold text-[#2e3a2f]">G</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-secondary">Google Workspace</p>
                <p className="text-[11px] text-text-muted">{google === "connected" ? `Connected${googleEmail ? ` as ${googleEmail}` : ""}` : "Connect Gmail, Calendar, Drive and Docs"}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={google === "connecting" || google === "disconnecting"}
                onClick={async () => {
                  if (google !== "connected") {
                    setGoogle("connecting");
                    window.location.assign("/api/integrations/google/connect");
                    return;
                  }
                  setGoogle("disconnecting");
                  try {
                    await api.googleDisconnect();
                    setGoogle("idle");
                    setGoogleEmail(null);
                  } catch {
                    setGoogle("connected");
                  }
                }}
              >
                {google === "connecting" ? "Connecting…" : google === "disconnecting" ? "Disconnecting…" : google === "connected" ? "Disconnect" : "Connect"}
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {["Gmail", "Calendar", "Drive", "Docs"].map((name) => <span key={name} className="rounded-md border border-border-faint bg-surface-raised px-2 py-1.5 text-center text-[11px] text-text-muted">{name}</span>)}
            </div>
          </div>
          {[
            ["Model providers", "OmniRoute · Devin · OpenCode · OpenAI — keys stay server-side"],
            ["Workspace terminal", "Runs as the agent user inside the session workspace"],
          ].map(([name, blurb]) => (
            <div key={name} className="flex items-center gap-3 rounded-panel border border-border-faint px-3 py-2.5">
              <span className="text-text-muted">
                <IconClock className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-secondary">{name}</p>
                <p className="truncate text-[11px] text-text-muted">{blurb}</p>
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-text-muted">Configured</span>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
