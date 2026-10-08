"use client";

import { cx } from "./ui";

/**
 * A small original Delvin companion: a soft sage-and-clay fox/moon creature.
 * Its motion is deliberately restrained in idle and livelier while the agent works.
 */
export function CompanionPet({
  status = "idle",
  className,
}: {
  status?: string;
  className?: string;
}) {
  const working = status === "thinking" || status === "running";

  return (
    <span
      className={cx("delvin-companion", working && "delvin-companion--working", className)}
      data-state={working ? "working" : status}
      role="img"
      aria-label={working ? "Delvin companion is working" : "Delvin companion is ready"}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true" focusable="false">
        <ellipse cx="60" cy="105" rx="27" ry="5" fill="#817b68" opacity=".16" />
        <path className="delvin-companion__tail" d="M79 88c19 9 25-5 17-13-5-5-12-3-15 2" fill="none" stroke="#82927b" strokeWidth="8" strokeLinecap="round" />
        <ellipse cx="61" cy="88" rx="24" ry="19" fill="#9eaa92" />
        <ellipse cx="61" cy="91" rx="12" ry="11" fill="#ede6d8" />
        <ellipse cx="46" cy="103" rx="8" ry="4" fill="#78876f" />
        <ellipse cx="73" cy="103" rx="8" ry="4" fill="#78876f" />
        <path d="M35 43c-7-12-7-25-2-31 12 3 19 11 21 24" fill="#8c9c84" />
        <path d="M69 36c5-14 14-21 26-22 3 12-1 24-10 34" fill="#8c9c84" />
        <path d="M40 39c-3-7-4-13-2-18 6 3 10 7 12 13" fill="#c98772" />
        <path d="M75 34c4-7 9-12 15-14 0 7-2 13-7 19" fill="#c98772" />
        <ellipse cx="60" cy="57" rx="34" ry="29" fill="#a8b39b" />
        <ellipse cx="60" cy="66" rx="19" ry="13" fill="#f1ebdf" />
        <ellipse cx="48" cy="57" rx="2.8" ry="3.7" fill="#30372f" className="delvin-companion__eye" />
        <ellipse cx="72" cy="57" rx="2.8" ry="3.7" fill="#30372f" className="delvin-companion__eye" />
        <ellipse cx="42" cy="66" rx="4" ry="2.2" fill="#cf8975" opacity=".42" />
        <ellipse cx="78" cy="66" rx="4" ry="2.2" fill="#cf8975" opacity=".42" />
        <path d="M57 64q3-3 6 0-1 4-3 4t-3-4Z" fill="#745147" />
        <path d="M60 68v3m0 0q-4 4-7 0m7 0q4 4 7 0" fill="none" stroke="#745147" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M42 81q18 9 36 0" fill="none" stroke="#c98772" strokeWidth="5" strokeLinecap="round" />
        <circle cx="45" cy="42" r="3" fill="#fff" opacity=".38" />
        <circle cx="36" cy="76" r="2" fill="#f4efe5" opacity=".7" />
      </svg>
      <span className="delvin-companion__sparkle" aria-hidden="true" />
    </span>
  );
}

/** Small inline version used beside live agent activity. */
export function WorkingPet({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span className={cx("delvin-working-pet inline-grid shrink-0 place-items-center", className)} aria-hidden="true">
      <CompanionPet status="running" className="h-full w-full" />
    </span>
  );
}
