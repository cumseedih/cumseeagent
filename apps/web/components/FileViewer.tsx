"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { IconChevronRight, IconFile, IconFolder, IconRefresh } from "./icons";
import { cx, Skeleton } from "./ui";

type Entry = { name: string; path: string; isDirectory: boolean; size?: number };

function humanSize(n?: number) {
  if (n === undefined || n === null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Workspace file browser with a read-only preview pane. */
export function FileViewer({ projectId, refreshKey }: { projectId: string; refreshKey?: number }) {
  const [path, setPath] = useState("/");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ path: string; content: string; truncated?: boolean } | null>(null);

  const load = useCallback(
    async (target: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.listFiles(projectId, target);
        setEntries(data.files || []);
        setPath(target);
      } catch (e: any) {
        setError(e.message || "Unable to list files");
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (projectId) load("/");
  }, [projectId, load]);

  useEffect(() => {
    if (projectId && refreshKey !== undefined) load(path);
    // `path` deliberately stays stable while an SSE file event refreshes the current folder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function openFile(target: string) {
    setError(null);
    try {
      const data = await api.getFileContent(projectId, target);
      setOpen({ path: target, content: data.content ?? "", truncated: data.truncated });
    } catch (e: any) {
      setError(e.message || "Unable to read file");
    }
  }

  const crumbs = path.split("/").filter(Boolean);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border-faint px-2 text-[11px] text-text-muted">
        <button onClick={() => load("/")} className="rounded-xs px-1 py-0.5 hover:bg-surface-raised/60 hover:text-text-tertiary">
          workspace
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <IconChevronRight className="h-3 w-3" />
            <button
              onClick={() => load("/" + crumbs.slice(0, i + 1).join("/"))}
              className="rounded-xs px-1 py-0.5 hover:bg-surface-raised/60 hover:text-text-tertiary"
            >
              {c}
            </button>
          </span>
        ))}
        <button
          onClick={() => load(path)}
          title="Refresh"
          className="ml-auto rounded-xs p-1 hover:bg-surface-raised/60 hover:text-text-tertiary"
        >
          <IconRefresh className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {loading && (
          <div className="space-y-1.5 p-1">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        )}
        {error && (
          <p className="rounded-sm border border-interactive-negative/30 bg-interactive-negative/[0.07] p-2 text-xs text-interactive-negative">
            {error}
          </p>
        )}
        {!loading && !error && entries.length === 0 && (
          <p className="p-2 text-xs text-text-muted">Empty directory.</p>
        )}
        {!loading &&
          entries.map((f) => (
            <button
              key={f.path}
              onClick={() => (f.isDirectory ? load(f.path) : openFile(f.path))}
              className={cx(
                "flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left font-mono text-[12px] transition-colors",
                open?.path === f.path ? "bg-surface-raised/70 text-text-primary" : "text-text-tertiary hover:bg-surface-raised/40"
              )}
            >
              {f.isDirectory ? (
                <IconFolder className="h-3.5 w-3.5 shrink-0 text-interactive-warning/80" />
              ) : (
                <IconFile className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              )}
              <span className="truncate">{f.name}</span>
              <span className="ml-auto shrink-0 text-[10px] text-text-muted">{f.isDirectory ? "" : humanSize(f.size)}</span>
            </button>
          ))}
      </div>

      {open && (
        <div className="flex max-h-[55%] shrink-0 flex-col border-t border-border-faint">
          <div className="flex h-8 items-center justify-between px-2">
            <span className="truncate font-mono text-[11px] text-text-tertiary">{open.path}</span>
            <button onClick={() => setOpen(null)} className="text-xs text-text-muted hover:text-text-tertiary">
              Close
            </button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto border-t border-border-faint bg-surface-floating p-3 font-mono text-[11.5px] leading-[1.6] text-text-secondary">
            <code>{open.content.slice(0, 20_000)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
