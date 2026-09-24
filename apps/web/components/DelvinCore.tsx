"use client";

import { cx } from "./ui";
import { BRANDING } from "../branding.config";

/** Delvin's living brand mark: a restrained portrait seal with useful status motion. */
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
      <span className="delvin-core-orbit delvin-core-orbit--wide" aria-hidden="true" />
      <span className="delvin-core-orbit delvin-core-orbit--tilt" aria-hidden="true" />
      <span className="delvin-core-satellite delvin-core-satellite--one" aria-hidden="true" />
      <span className="delvin-core-satellite delvin-core-satellite--two" aria-hidden="true" />
      <span className="delvin-core-shadow" aria-hidden="true" />
      <span className="delvin-core-sphere" aria-hidden="true">
        <img src={BRANDING.LOGO_PATH} alt="" className="delvin-core-portrait" />
        <span className="delvin-core-glint" />
        <span className="delvin-core-inner-ring" />
      </span>
    </div>
  );
}
