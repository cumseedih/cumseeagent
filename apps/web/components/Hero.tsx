"use client";

import { BRANDING } from "../branding.config";
import { HeroMark } from "./Wordmark";
import { Button, Card } from "./ui";
import { IconGithub, IconPlusChat } from "./icons";

/**
 * Empty-state hero shown before the first prompt in a session.
 * Editorial headline + the signature highlight block on the last word,
 * followed by the repository/GitHub connector card.
 */
export function Hero({
  onNewSession,
  project,
  onConnectGitHub,
  repoBusy,
  repoError,
}: {
  onNewSession: () => void;
  project?: { id: string; name: string; defaultBranch?: string } | null;
  onConnectGitHub?: () => void;
  repoBusy?: boolean;
  repoError?: string | null;
}) {
  return (
    <div className="animate-rise flex flex-col items-center">
      <HeroMark className="mb-5 h-14 w-14 text-text-secondary sm:h-16 sm:w-16" />

      <h1 className="headline-hero font-serif-display animate-rise delay-1 mb-3 text-center text-text-tertiary">
        {BRANDING.HERO_TITLE_LEAD}
        <span className="hidden sm:inline"> </span>
        <br className="sm:hidden" />
        {BRANDING.HERO_TITLE_TAIL}{" "}
        <span className="inline-block bg-highlight px-2 align-baseline italic leading-[1] text-highlight-foreground">
          {BRANDING.HERO_TITLE_HIGHLIGHT}
        </span>
      </h1>

      <p className="animate-rise delay-2 mb-6 max-w-xl text-center text-sm leading-relaxed text-text-muted">
        {BRANDING.HERO_SUBTITLE}
      </p>

      <div className="animate-rise delay-3 grid w-full max-w-[720px] gap-3 sm:grid-cols-2">
        {/* Repository connector */}
        <Card className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">
              <IconGithub className="h-4 w-4" />
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Repository</span>
          </div>
          {repoBusy && <div className="h-4 w-2/3 animate-shimmer rounded-sm bg-surface-skeleton/60" />}
          {!repoBusy && repoError && <p className="text-xs text-interactive-negative">{repoError}</p>}
          {!repoBusy && !repoError && (
            <>
              <p className="truncate text-sm text-text-secondary">{project?.name || "No repository connected"}</p>
              <p className="truncate font-mono text-[11px] text-text-muted">
                {project ? `${project.id.slice(0, 8)} · ${project.defaultBranch || "main"}` : "Connect a repo to run agent sessions"}
              </p>
            </>
          )}
          <div className="mt-auto pt-1">
            <Button variant="secondary" size="sm" onClick={onConnectGitHub} className="w-full">
              <IconGithub className="h-3.5 w-3.5" />
              {project ? "Manage repository" : "Connect your GitHub"}
            </Button>
          </div>
        </Card>

        {/* Session starter */}
        <Card className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">
              <IconPlusChat className="h-4 w-4" />
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Session</span>
          </div>
          <p className="text-sm text-text-secondary">Start a fresh agent session</p>
          <p className="text-[11px] leading-relaxed text-text-muted">
            Persistent history, streaming output, terminal access and approval gates on every risky command.
          </p>
          <div className="mt-auto pt-1">
            <Button variant="primary" size="sm" onClick={onNewSession} className="w-full">
              <IconPlusChat className="h-3.5 w-3.5" />
              New session
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
