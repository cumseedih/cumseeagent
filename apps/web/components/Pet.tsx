"use client";

import { DelvinCore } from "./DelvinCore";

/** Tiny, status-line companion shown only while the agent is actively working. */
export function WorkingPet({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span className={`delvin-working-pet inline-grid shrink-0 place-items-center ${className}`} aria-hidden="true">
      <DelvinCore status="running" variant="pluto" className="h-full w-full" />
    </span>
  );
}
