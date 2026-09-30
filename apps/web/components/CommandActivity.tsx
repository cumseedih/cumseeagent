"use client";

import { useState } from "react";
import { IconCheck, IconChevronDown, IconCopy, IconTerminal, IconX } from "./icons";
import { cx } from "./ui";

export type AgentEvent = {
  id: string;
  eventType: string;
  payload?: Record<string, any>;
  createdAt?: string;
};

export type CommandActivity = {
  id: string;
  command: string;
  cwd?: string;
  status: "waiting" | "running" | "completed" | "failed";
  stdout: string;
  stderr: string;
  exitCode?: number | null;
  startedAt?: string;
};

const MAX_RENDERED_OUTPUT = 16_000;

function appendOutput(current: string, chunk: unknown) {
  if (typeof chunk !== "string" || !chunk) return current;
  return `${current}${chunk}`.slice(-MAX_RENDERED_OUTPUT);
}

/** Reduces persisted + live terminal SSE events into one stable card per command. */
export function commandActivitiesFromEvents(events: AgentEvent[]): CommandActivity[] {
  const activities = new Map<string, CommandActivity>();
  const aliases = new Map<string, string>();

  for (const event of events) {
    if (!event.eventType.startsWith("tool.")) continue;
    const payload = event.payload || {};
    const argumentsValue = payload.arguments && typeof payload.arguments === "object" ? payload.arguments : {};
    const command = typeof payload.command === "string"
      ? payload.command
      : typeof argumentsValue.command === "string"
        ? argumentsValue.command
        : "";
    const toolCallId = typeof payload.toolCallId === "string" ? payload.toolCallId : "";
    const terminalCommandId = typeof payload.terminalCommandId === "string" ? payload.terminalCommandId : "";
    const knownKey = aliases.get(toolCallId) || aliases.get(terminalCommandId);
    const isTerminal = payload.toolName === "terminal" || Boolean(command) || Boolean(knownKey);
    if (!isTerminal) continue;

    const key = knownKey || toolCallId || terminalCommandId;
    if (!key) continue;
    let activity = activities.get(key);
    if (!activity) {
      if (!command) continue;
      activity = {
        id: key,
        command,
        cwd: typeof payload.cwd === "string" ? payload.cwd : argumentsValue.cwd,
        status: event.eventType === "tool.approval_required" ? "waiting" : "running",
        stdout: "",
        stderr: "",
        startedAt: event.createdAt,
      };
      activities.set(key, activity);
    }
    if (toolCallId) aliases.set(toolCallId, key);
    if (terminalCommandId) aliases.set(terminalCommandId, key);
    if (command) activity.command = command;
    if (typeof payload.cwd === "string") activity.cwd = payload.cwd;

    if (event.eventType === "tool.approval_required") activity.status = "waiting";
    if (event.eventType === "tool.started") activity.status = "running";
    if (event.eventType === "tool.stdout") activity.stdout = appendOutput(activity.stdout, payload.chunk);
    if (event.eventType === "tool.stderr") activity.stderr = appendOutput(activity.stderr, payload.chunk);
    if (event.eventType === "tool.completed") activity.status = "completed";
    if (event.eventType === "tool.failed" || event.eventType === "tool.rejected") activity.status = "failed";

    const result = payload.result && typeof payload.result === "object" ? payload.result : null;
    if (result) {
      if (!activity.stdout) activity.stdout = appendOutput("", result.stdout);
      if (!activity.stderr) activity.stderr = appendOutput("", result.stderr);
      if (typeof result.exitCode === "number" || result.exitCode === null) activity.exitCode = result.exitCode;
    }
    if (typeof payload.exitCode === "number" || payload.exitCode === null) activity.exitCode = payload.exitCode;
    if (event.eventType === "tool.failed" && !activity.stderr) {
      activity.stderr = String(payload.error || payload.reason || "Command failed");
    }
  }

  return [...activities.values()].sort((a, b) => {
    const aTime = a.startedAt ? Date.parse(a.startedAt) : 0;
    const bTime = b.startedAt ? Date.parse(b.startedAt) : 0;
    return aTime - bTime;
  });
}

function statusLabel(activity: CommandActivity) {
  if (activity.status === "waiting") return "Waiting for approval";
  if (activity.status === "running") return "Running command";
  if (activity.status === "failed") return "Command failed";
  return "Ran command";
}

function CommandCard({ activity }: { activity: CommandActivity }) {
  const [open, setOpen] = useState(activity.status === "running" || activity.status === "failed");
  const output = [activity.stdout, activity.stderr].filter(Boolean).join(activity.stdout && activity.stderr ? "\n" : "");
  const isRunning = activity.status === "running";
  const failed = activity.status === "failed";

  return (
    <li className="animate-stage-in overflow-hidden rounded-[14px] border border-[#e5e5e2] bg-[#fbfbfa] text-[#343432] shadow-[0_2px_10px_rgba(26,26,24,0.035)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-2.5 px-3 text-left transition-colors hover:bg-black/[0.025]"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#e7e7e3] bg-white text-[#65655f]">
          <IconTerminal className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[12px] font-medium">
            {statusLabel(activity)}
            {isRunning && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6b7c69]" />}
          </span>
          <span className="block truncate font-mono text-[11px] text-[#777771]">$ {activity.command}</span>
        </span>
        {activity.status === "completed" && <IconCheck className="h-4 w-4 shrink-0 text-[#63765f]" />}
        {failed && <IconX className="h-4 w-4 shrink-0 text-[#a45e55]" />}
        <IconChevronDown className={cx("h-4 w-4 shrink-0 text-[#8b8b85] transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-[#ecece8] px-3 pb-3 pt-2.5">
          <div className="mb-2 flex items-start gap-2">
            <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[11px] leading-[1.55] text-[#2f2f2c]">$ {activity.command}</code>
            <button
              type="button"
              aria-label="Copy command"
              onClick={(event) => { event.stopPropagation(); void navigator.clipboard?.writeText(activity.command); }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#7b7b75] transition-colors hover:bg-white hover:text-[#262624]"
            >
              <IconCopy className="h-4 w-4" />
            </button>
          </div>
          {activity.cwd && <p className="mb-2 truncate font-mono text-[10px] text-[#9a9a94]">in {activity.cwd}</p>}
          {output ? (
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-[10px] bg-[#242421] px-3 py-2.5 font-mono text-[11px] leading-[1.55] text-[#e9e9e4]">{output}</pre>
          ) : (
            <p className="rounded-[10px] bg-[#f2f2ef] px-3 py-2 font-mono text-[11px] text-[#85857f]">
              {isRunning ? "Waiting for output…" : activity.status === "waiting" ? "Approval required before execution." : "Command completed with no output."}
            </p>
          )}
          {activity.exitCode !== undefined && (
            <p className={cx("mt-2 font-mono text-[10px]", failed ? "text-[#a45e55]" : "text-[#7c8b78]")}>Exit code {String(activity.exitCode)}</p>
          )}
        </div>
      )}
    </li>
  );
}

export function CommandActivityList({ activities }: { activities: CommandActivity[] }) {
  if (!activities.length) return null;
  return (
    <ol className="my-1 space-y-2" aria-label="Executed commands">
      {activities.map((activity) => <CommandCard key={activity.id} activity={activity} />)}
    </ol>
  );
}
