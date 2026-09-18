"use client";

import { useMemo, useState } from "react";
import { cx } from "./ui";
import { IconChevronDown, IconChevronRight, IconTerminal, IconFile, IconGitBranch, IconShield, IconSparkle } from "./icons";

type TimelineEvent = {
  id: string;
  eventType: string;
  payload?: any;
  createdAt?: string;
};

const TONE: Record<string, { color: string; label: string }> = {
  "agent.started": { color: "text-interactive-link", label: "Agent started" },
  "agent.thinking": { color: "text-text-tertiary", label: "Thinking" },
  "agent.plan.created": { color: "text-interactive-link", label: "Plan created" },
  "agent.completed": { color: "text-interactive-positive", label: "Completed" },
  "agent.failed": { color: "text-interactive-negative", label: "Failed" },
  "tool.requested": { color: "text-interactive-warning", label: "Tool requested" },
  "tool.created": { color: "text-interactive-warning", label: "Tool requested" },
  "tool.approval_required": { color: "text-interactive-warning", label: "Needs approval" },
  "tool.stdout": { color: "text-text-tertiary", label: "stdout" },
  "tool.stderr": { color: "text-interactive-negative", label: "stderr" },
  "tool.failed": { color: "text-interactive-negative", label: "Tool failed" },
  "file.created": { color: "text-interactive-link", label: "File created" },
  "file.modified": { color: "text-interactive-link", label: "File modified" },
  "tool.approved": { color: "text-interactive-positive", label: "Approved" },
  "tool.rejected": { color: "text-interactive-negative", label: "Rejected" },
  "tool.started": { color: "text-interactive-link", label: "Running" },
  "tool.completed": { color: "text-interactive-positive", label: "Finished" },
  "file.written": { color: "text-interactive-link", label: "File written" },
  "terminal.output": { color: "text-text-tertiary", label: "Terminal output" },
};

function toneFor(type: string) {
  return TONE[type] || { color: "text-text-tertiary", label: type };
}

function iconFor(type: string) {
  if (type.startsWith("terminal")) return <IconTerminal className="h-3.5 w-3.5" />;
  if (type.startsWith("file")) return <IconFile className="h-3.5 w-3.5" />;
  if (type.startsWith("git")) return <IconGitBranch className="h-3.5 w-3.5" />;
  if (type.startsWith("approval") || type.includes("rejected")) return <IconShield className="h-3.5 w-3.5" />;
  return <IconSparkle className="h-3.5 w-3.5" />;
}

function summarize(e: TimelineEvent) {
  const p = e.payload || {};
  return p.toolName || p.command || p.path || p.title || p.message || p.summary || p.goal || p.model || (Object.keys(p)[0] ?? "—");
}

/** A display row: consecutive streaming deltas of the same run collapse into one. */
type Row = { key: string; event: TimelineEvent; count: number; tail?: string };

function collapse(events: TimelineEvent[]): Row[] {
  const rows: Row[] = [];
  for (const e of events) {
    const isStream =
      /delta|chunk|output/i.test(e.eventType) || typeof e.payload?.delta === "string";
    const prev = rows[rows.length - 1];
    if (
      prev &&
      isStream &&
      prev.event.eventType === e.eventType &&
      (prev.event.payload?.agentRunId ?? "") === (e.payload?.agentRunId ?? "")
    ) {
      prev.count += 1;
      if (typeof e.payload?.delta === "string") prev.tail = e.payload.delta;
      continue;
    }
    rows.push({
      key: e.id,
      event: e,
      count: 1,
      tail: typeof e.payload?.delta === "string" ? e.payload.delta : undefined,
    });
  }
  return rows;
}

/** Collapsible activity feed — the agent's "what am I doing" rail. */
export function ToolTimeline({ events, compact }: { events: TimelineEvent[]; compact?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      collapse(
        events.filter(
          (e) =>
            e.eventType.startsWith("tool.") || e.eventType.startsWith("agent.") || e.eventType.startsWith("file.")
        )
      ).slice(-80),
    [events]
  );

  if (!rows.length) {
    return <p className="px-1 py-4 text-xs text-text-muted">No agent activity yet. Send a prompt to start a run.</p>;
  }

  return (
    <ol className="space-y-0.5">
      {rows.map((row) => {
        const e = row.event;
        const tone = toneFor(e.eventType);
        const open = openId === row.key;
        return (
          <li key={row.key}>
            <button
              onClick={() => setOpenId(open ? null : row.key)}
              className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-surface-raised/40"
            >
              <span className={cx("mt-[3px] shrink-0", tone.color)}>{iconFor(e.eventType)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cx("shrink-0 text-xs", tone.color)}>{tone.label}</span>
                  <span className="truncate font-mono text-[11px] text-text-muted">
                    {row.tail ? row.tail.replace(/\s+/g, " ").slice(-60) : summarize(e)}
                  </span>
                  {row.count > 1 && (
                    <span className="shrink-0 rounded-full border border-border-faint px-1.5 text-[10px] text-text-muted">
                      ×{row.count}
                    </span>
                  )}
                  {e.createdAt && (
                    <span className="ml-auto shrink-0 text-[10px] text-text-muted">
                      {new Date(e.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  )}
                </span>
                {!compact && open && (
                  <pre className="mt-1.5 max-h-48 overflow-auto rounded-sm border border-border-faint bg-surface-floating p-2 font-mono text-[11px] leading-relaxed text-text-tertiary">
                    {JSON.stringify(e.payload ?? {}, null, 2).slice(0, 4000)}
                  </pre>
                )}
              </span>
              <span className="mt-[3px] shrink-0 text-text-muted">
                {compact ? null : open ? (
                  <IconChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <IconChevronRight className="h-3.5 w-3.5" />
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
