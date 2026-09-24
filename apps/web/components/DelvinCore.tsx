"use client";

import { cx } from "./ui";

/** A small, status-aware 3D agent presence for Delvin's otherwise quiet canvas. */
export function DelvinCore({ status = "idle", className }: { status?: string; className?: string }) {
  const working = status === "thinking" || status === "running";
  return (
    <div
      className={cx("delvin-core-scene", working && "delvin-core-scene--working", className)}
      data-state={working ? "working" : status}
      role="img"
      aria-label={working ? "Delvin agent is working" : "Delvin agent is ready"}
    >
      <span className="delvin-core-orbit delvin-core-orbit--wide" aria-hidden="true" />
      <span className="delvin-core-orbit delvin-core-orbit--tilt" aria-hidden="true" />
      <span className="delvin-core-satellite" aria-hidden="true" />
      <span className="delvin-core-shadow" aria-hidden="true" />
      <span className="delvin-core-sphere" aria-hidden="true">
        <span className="delvin-core-glint" />
        <span className="delvin-core-seed" />
        <span className="delvin-core-inner-ring" />
      </span>
    </div>
  );
}
