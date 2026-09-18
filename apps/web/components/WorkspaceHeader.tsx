"use client";

import { useState } from "react";
import { BRANDING } from "../branding.config";
import { ModelSelector } from "./ModelSelector";
import { StatusPill, Chip, cx } from "./ui";
import { IconGitBranch, IconGithub, IconPanelLeft, IconTerminal, IconFolder } from "./icons";

/**
 * Top bar: sidebar toggle, repo/branch context pickers, live status,
 * harness+model selection, and the terminal/files rail toggle.
 */
export function WorkspaceHeader({
  status,
  project,
  branch,
  onBranchChange,
  branches,
  model,
  providerId,
  harness,
  onHarnessChange,
  onModelChange,
  onToggleSidebar,
  railOpen,
  onToggleRail,
  railTab,
  onRailTabChange,
  sessionTitle,
}: {
  status: string;
  project?: { id: string; name: string } | null;
  branch: string;
  branches: string[];
  onBranchChange: (b: string) => void;
  model: string;
  providerId?: string;
  harness: string;
  onHarnessChange: (h: string) => void;
  onModelChange: (m: string, p: string) => void;
  onToggleSidebar?: () => void;
  railOpen: boolean;
  onToggleRail: () => void;
  railTab: "terminal" | "files" | "activity";
  onRailTabChange: (t: "terminal" | "files" | "activity") => void;
  sessionTitle?: string;
}) {
  const [branchOpen, setBranchOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 overflow-hidden border-b border-border-faint bg-surface-primary/95 px-2 backdrop-blur sm:px-3">
      <button
        onClick={onToggleSidebar}
        title="Toggle sidebar"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-text-muted transition-colors hover:bg-surface-raised/60 hover:text-interactive-active"
      >
        <IconPanelLeft className="h-4 w-4" />
      </button>

      {/* Repository + branch */}
      <div className="flex min-w-0 shrink items-center gap-1.5">
        <Chip
          className="hidden max-w-[140px] sm:inline-flex sm:max-w-[240px]"
          title={project ? `Repository: ${project.name}` : "No repository connected"}
        >
          <IconGithub className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{project?.name || "Connect repository"}</span>
        </Chip>
        <span className="inline-flex sm:hidden" title={project ? `Repository: ${project.name}` : "No repository"}>
          <IconGithub className="h-4 w-4 text-text-tertiary" />
        </span>

        <div className="relative">
          <Chip
            onClick={() => setBranchOpen((v) => !v)}
            title="Branch"
            className={cx("hidden sm:inline-flex", branchOpen && "border-border-medium bg-surface-raised")}
          >
            <IconGitBranch className="h-3.5 w-3.5" />
            <span className="max-w-[120px] truncate font-mono text-[11px]">{branch || "main"}</span>
          </Chip>

          {branchOpen && (
            <div className="absolute left-0 z-40 mt-1.5 w-56 animate-slide-up overflow-hidden rounded-panel border border-border-medium bg-surface-floating py-1 shadow-floating">
              <p className="px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-text-muted">Branch</p>
              {(branches.length ? branches : [branch || "main"]).map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    onBranchChange(b);
                    setBranchOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs text-text-tertiary transition-colors hover:bg-surface-raised/60 hover:text-interactive-active"
                >
                  {b}
                </button>
              ))}
              {branches.length === 0 && (
                <p className="px-3 pt-1 text-[10px] leading-relaxed text-text-muted">
                  Branch list appears once a git remote is connected.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {sessionTitle && (
        <span className="hidden min-w-0 flex-1 truncate px-2 text-xs text-text-muted lg:block">{sessionTitle}</span>
      )}
      {!sessionTitle && <span className="min-w-0 flex-1" />}

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden sm:inline-flex">
          <StatusPill status={status} />
        </span>
        <ModelSelector
          value={model}
          providerId={providerId}
          harness={harness}
          onHarnessChange={onHarnessChange}
          onChange={onModelChange}
        />
        <div className="hidden items-center gap-1 rounded-sm border border-border-faint p-0.5 md:flex">
          {(
            [
              ["terminal", <IconTerminal key="t" className="h-3.5 w-3.5" />, "Terminal"],
              ["files", <IconFolder key="f" className="h-3.5 w-3.5" />, "Files"],
              ["activity", <IconGitBranch key="a" className="h-3.5 w-3.5" />, "Activity"],
            ] as const
          ).map(([key, icon, title]) => (
            <button
              key={key}
              title={`${title} panel`}
              onClick={() => {
                if (!railOpen || railTab !== key) {
                  onRailTabChange(key);
                  if (!railOpen) onToggleRail();
                } else {
                  onToggleRail();
                }
              }}
              className={cx(
                "grid h-6 w-7 place-items-center rounded-xs transition-colors",
                railOpen && railTab === key
                  ? "bg-surface-raised text-interactive-active"
                  : "text-text-muted hover:text-interactive-active"
              )}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
