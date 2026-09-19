"use client";

import { BRANDING } from "../branding.config";
import { HeroMark } from "./Wordmark";

/**
 * Empty-state hero.
 *
 * Composition mirrors the agent workspace reference: the mark sits centred
 * above an editorial headline, with the final word on a highlight block, and
 * the composer anchored directly beneath it. Connector actions (repository,
 * settings) live in the sidebar footer rather than competing with the prompt.
 */
export function Hero({ busy }: { busy?: boolean }) {
  return (
    <div className="animate-rise flex flex-col items-center">
      <HeroMark className="mb-5 h-12 w-12 sm:h-14 sm:w-14" />

      <h1 className="headline-hero font-serif-display animate-rise delay-1 mb-4 text-center text-text-tertiary">
        {BRANDING.HERO_TITLE_LEAD}
        <span className="hidden sm:inline"> </span>
        <br className="sm:hidden" />
        {BRANDING.HERO_TITLE_TAIL}{" "}
        <span className="inline-block bg-highlight px-2 align-baseline italic leading-[1] text-highlight-foreground">
          {BRANDING.HERO_TITLE_HIGHLIGHT}
        </span>
      </h1>

      <p className="animate-rise delay-2 mb-2 max-w-xl text-center text-sm leading-relaxed text-text-muted">
        {BRANDING.HERO_SUBTITLE}
      </p>

      {busy && (
        <p className="animate-fade flex items-center gap-2 text-[11px] text-text-muted">
          <span className="h-1.5 w-1.5 animate-caret rounded-full bg-highlight" />
          Preparing workspace…
        </p>
      )}
    </div>
  );
}
