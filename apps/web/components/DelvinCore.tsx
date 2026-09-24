"use client";

import { cx } from "./ui";

/** Delvin's living agent presence: a quiet Saturn system with status-aware motion. */
export function DelvinCore({ status = "idle", className }: { status?: string; className?: string }) {
  const working = status === "thinking" || status === "running";
  return (
    <div
      className={cx("delvin-core-scene", working && "delvin-core-scene--working", className)}
      data-state={working ? "working" : status}
      role="img"
      aria-label={working ? "Delvin agent is working" : "Delvin agent is ready"}
    >
      <span className="delvin-core-aura" aria-hidden="true" />
      <span className="delvin-core-satellite delvin-core-satellite--one" aria-hidden="true" />
      <span className="delvin-core-satellite delvin-core-satellite--two" aria-hidden="true" />
      <span className="delvin-core-shadow" aria-hidden="true" />
      <span className="delvin-core-ring delvin-core-ring--back" aria-hidden="true" />
      <span className="delvin-core-sphere" aria-hidden="true">
        <span className="delvin-core-band delvin-core-band--one" />
        <span className="delvin-core-band delvin-core-band--two" />
        <span className="delvin-core-glint" />
      </span>
      <span className="delvin-core-ring delvin-core-ring--front" aria-hidden="true" />
    </div>
  );
}
