"use client";

import { DelvinCore } from "./DelvinCore";

/**
 * One companion, not a collection of selectable mascots. It is the same
 * Delvin core the user meets on the empty canvas, scaled down once a chat is
 * underway so the agent has a quiet, recognisable presence while it works.
 */
export function WorkspacePet({ active, status }: { active: boolean; status?: string }) {
  if (!active) return null;

  return (
    <div className="pointer-events-none fixed bottom-[138px] right-3 z-30 select-none sm:bottom-[100px] sm:right-4" aria-label="Delvin companion">
      <div className="delvin-companion relative grid h-[62px] w-[62px] place-items-center sm:h-[72px] sm:w-[72px]">
        <DelvinCore status={status} variant="companion" className="h-[58px] w-[58px] sm:h-[66px] sm:w-[66px]" />
      </div>
    </div>
  );
}
