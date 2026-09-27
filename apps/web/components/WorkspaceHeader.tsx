"use client";

import { BRANDING } from "../branding.config";
import { StatusPill, Chip, cx } from "./ui";
import { IconBolt, IconChevronDown, IconDots, IconGitBranch, IconGithub, IconPanelLeft, IconPencil, IconShield, IconTerminal, IconFolder } from "./icons";

/**
 * Top bar: sidebar toggle, repo/branch context pickers, live status,
 * harness selection and the terminal/files rail toggle.
 */
export function WorkspaceHeader({
  status,
  project,
  branch,
  harness,
  onToggleSidebar,
  onOpenRepository,
  onOpenBranch,
  onOpenHarness,
  onOpenWorkspace,
  quota,
  railOpen,
  onToggleRail,
  railTab,
  onRailTabChange,
  sessionTitle,
  onNewChat,
}: {
  status: string;
  project?: { id: string; name: string } | null;
  branch: string;
  harness: string;
  onToggleSidebar?: () => void;
  onOpenRepository?: () => void;
  onOpenBranch?: () => void;
  onOpenHarness?: () => void;
  onOpenWorkspace?: () => void;
  quota?: { remaining: number | null; limit: number; exhausted: boolean; unlimited: boolean } | null;
  railOpen: boolean;
  onToggleRail: () => void;
  railTab: "terminal" | "files" | "activity";
  onRailTabChange: (t: "terminal" | "files" | "activity") => void;
  sessionTitle?: string;
  onNewChat?: () => void;
}) {

  return (
    <header className="flex min-h-[72px] shrink-0 items-center gap-2 overflow-hidden border-b border-border-faint bg-surface-primary/90 px-4 backdrop-blur sm:min-h-[56px]">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:hidden">
        <button onClick={onToggleSidebar} aria-label="Open sessions" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border-faint bg-surface-secondary text-text-primary shadow-[0_3px_12px_rgba(46,43,41,0.06)]">
          <span className="flex w-[19px] flex-col gap-[5px]" aria-hidden="true"><span className="h-px w-full bg-current" /><span className="h-px w-full bg-current" /><span className="h-px w-full bg-current" /></span>
        </button>
        <span className="min-w-0 truncate text-[16px] font-semibold text-text-primary">{sessionTitle || "New chat"}</span>
      </div>
      <div className="flex shrink-0 items-center overflow-hidden rounded-full border border-border-faint bg-surface-secondary shadow-[0_3px_12px_rgba(46,43,41,0.06)] sm:hidden">
        <button type="button" onClick={onNewChat} aria-label="New chat" className="grid h-11 w-11 place-items-center text-text-primary transition-colors hover:bg-surface-raised"><IconPencil className="h-5 w-5" /></button>
        <button type="button" onClick={onOpenWorkspace} aria-label="Open workspace menu" className="grid h-11 w-11 place-items-center text-text-primary transition-colors hover:bg-surface-raised"><IconDots className="h-5 w-5" /></button>
      </div>
      <button
        onClick={onToggleSidebar}
        title="Toggle sidebar"
        className="hidden h-8 w-8 shrink-0 place-items-center rounded-sm text-text-muted transition-colors hover:bg-surface-raised/60 hover:text-interactive-active sm:grid"
      >
        <IconPanelLeft className="h-4 w-4" />
      </button>

      {/* Repository + branch */}
      <div className="hidden min-w-0 shrink items-center gap-1.5 sm:flex">
        <Chip
          onClick={onOpenRepository}
          data-testid="repo-chip"
          className="hidden max-w-[140px] sm:inline-flex sm:max-w-[240px]"
          title={project ? `Repository: ${project.name}` : "Select a repository"}
        >
          <IconGithub className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{project?.name || "Connect repository"}</span>
        </Chip>
        <span className="inline-flex sm:hidden" title={project ? `Repository: ${project.name}` : "No repository"}>
          <IconGithub className="h-4 w-4 text-text-tertiary" />
        </span>

        <Chip
          onClick={onOpenBranch}
          data-testid="branch-chip"
          title="Branch"
          className="hidden sm:inline-flex"
        >
          <IconGitBranch className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate font-mono text-[11px]">{branch || "main"}</span>
        </Chip>
      </div>

      {sessionTitle && (
        <span className="hidden min-w-0 flex-1 truncate px-2 text-xs text-text-muted lg:block">{sessionTitle}</span>
      )}
      {!sessionTitle && <span className="hidden min-w-0 flex-1 sm:block" />}

      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <button
          type="button"
          onClick={onOpenWorkspace}
          title="Open workspace files"
          aria-label="Open workspace files"
          className="grid h-9 w-9 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-raised hover:text-interactive-link"
        >
          <IconFolder className="h-[21px] w-[21px]" />
        </button>
        {quota && !quota.unlimited && (
          <span
            title={
              quota.exhausted
                ? "Daily allowance used up — resets at UTC midnight"
                : `${quota.remaining} of ${quota.limit} runs left today`
            }
            className={cx(
              "hidden h-6 items-center gap-1.5 rounded-full border px-2 text-[11px] lg:inline-flex",
              quota.exhausted
                ? "border-interactive-negative/40 text-interactive-negative"
                : "border-border-faint text-text-muted"
            )}
          >
            <IconBolt className="h-3 w-3" />
            {quota.exhausted ? "Out of credits for today" : `${quota.remaining}/${quota.limit}`}
          </span>
        )}
        <span className="hidden sm:inline-flex">
          <StatusPill status={status} />
        </span>
        <Chip onClick={onOpenHarness} data-testid="harness-chip" title="Agent harness" className="hidden md:inline-flex">
          <IconShield className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate">
            {harness === "fast" ? "Fast harness" : harness === "testing" ? "Harness for testing" : "Standard harness"}
          </span>
          <IconChevronDown className="h-3.5 w-3.5" />
        </Chip>
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
