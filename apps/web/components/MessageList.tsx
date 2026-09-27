"use client";

import { useState } from "react";
import { Markdown } from "../lib/markdown";
import { IconCopy, IconShare, IconThumbDown, IconThumbUp } from "./icons";
import { WorkingPet } from "./Pet";
import { cx } from "./ui";

type Message = {
  id: string;
  role: string;
  content: string;
  status?: string;
  createdAt?: string;
};

type AgentEvent = {
  id: string;
  eventType: string;
  payload?: Record<string, any>;
};

function activityLabel(event: AgentEvent) {
  const payload = event.payload || {};
  if (event.eventType === "agent.started") return "Orchestrating";
  if (event.eventType === "agent.thinking") return "Thinking through the task";
  if (event.eventType === "tool.approval_required") return `Waiting for approval${payload.toolName ? ` · ${payload.toolName}` : ""}`;
  if (event.eventType === "tool.started") return `Using ${payload.toolName || "tool"}`;
  if (event.eventType === "tool.completed") return `Used ${payload.toolName || "tool"}`;
  if (event.eventType === "tool.failed") return `${payload.toolName || "Tool"} failed`;
  if (event.eventType === "file.created") return `Writing ${payload.path || "file"}`;
  if (event.eventType === "file.modified") return `Updating ${payload.path || "file"}`;
  return null;
}

function timeOf(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Conversation transcript: assistant turns render markdown, user turns a bubble. */
export function MessageList({
  messages,
  streaming,
  thinking,
  streamingText = "",
  events = [],
}: {
  messages: Message[];
  streaming?: boolean;
  thinking?: boolean;
  streamingText?: string;
  events?: AgentEvent[];
}) {
  const [rated, setRated] = useState<Record<string, "up" | "down" | undefined>>({});
  if (!messages.length) return null;

  const activity = events
    .map((event) => ({ event, label: activityLabel(event) }))
    .filter((item): item is { event: AgentEvent; label: string } => Boolean(item.label))
    .slice(-5);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 md:gap-7">
      {messages.map((m) => {
        const isUser = m.role === "user";
        if (isUser) {
          return (
            <div key={m.id} className="animate-message-in flex justify-end">
              <div className="group max-w-[82%] rounded-[22px] rounded-br-[7px] bg-surface-raised/70 px-4 py-2.5 shadow-[inset_0_0_0_1px_hsl(var(--border-faint))] md:max-w-[75%]">
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-text-primary">{m.content}</p>
                <div className="mt-1.5 flex items-center justify-end gap-2 text-[10px] text-text-muted">
                  <button
                    onClick={() => navigator.clipboard?.writeText(m.content)}
                    className="opacity-0 transition-opacity hover:text-text-tertiary group-hover:opacity-100"
                  >
                    Copy
                  </button>
                  {timeOf(m.createdAt)}
                </div>
              </div>
            </div>
          );
        }

        const vote = rated[m.id];
        return (
          <article key={m.id} className="animate-stage-in min-w-0">
            <div className="min-w-0 text-[15px] leading-[1.75]"><Markdown text={m.content} /></div>
            <div className="mt-3 flex items-center gap-1 text-text-muted" aria-label="Response actions">
              <button type="button" aria-label="Good response" aria-pressed={vote === "up"} onClick={() => setRated((current) => ({ ...current, [m.id]: current[m.id] === "up" ? undefined : "up" }))} className={cx("grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-surface-raised hover:text-text-primary", vote === "up" && "bg-surface-raised text-text-primary")}><IconThumbUp className="h-[19px] w-[19px]" /></button>
              <button type="button" aria-label="Bad response" aria-pressed={vote === "down"} onClick={() => setRated((current) => ({ ...current, [m.id]: current[m.id] === "down" ? undefined : "down" }))} className={cx("grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-surface-raised hover:text-text-primary", vote === "down" && "bg-surface-raised text-text-primary")}><IconThumbDown className="h-[19px] w-[19px]" /></button>
              <button type="button" aria-label="Copy response" onClick={() => navigator.clipboard?.writeText(m.content)} className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-surface-raised hover:text-text-primary"><IconCopy className="h-[19px] w-[19px]" /></button>
              <button type="button" aria-label="Share response" onClick={async () => {
                if (navigator.share) await navigator.share({ text: m.content }).catch(() => undefined);
                else await navigator.clipboard?.writeText(m.content);
              }} className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-surface-raised hover:text-text-primary"><IconShare className="h-[19px] w-[19px]" /></button>
            </div>
          </article>
        );
      })}

      {streamingText && (
        <div className="animate-stage-in min-w-0" aria-live="polite">
          <Markdown text={streamingText} />
        </div>
      )}

      {(streaming || thinking) && activity.length > 0 && (
        <div className="ml-1 space-y-2.5" aria-live="polite" aria-label="Agent activity">
          {activity.map(({ event, label }, index) => {
            const current = index === activity.length - 1;
            const failed = event.eventType === "tool.failed";
            const done = event.eventType === "tool.completed";
            return (
              <div
                key={event.id}
                className="animate-stage-in flex items-center gap-2.5 text-[12px] text-text-tertiary"
                style={{ animationDelay: `${Math.min(index * 45, 180)}ms` }}
              >
                {current && !failed && !done ? <WorkingPet className="h-5 w-5" /> : <span
                  className={cx(
                    "h-2 w-2 shrink-0 rounded-full",
                    failed ? "bg-interactive-negative" : done ? "bg-interactive-positive" : "bg-[hsl(var(--brand-secondary))]"
                  )}
                />}
                <span className={cx(current && !failed && "activity-shimmer-text")}>{label}</span>
                {done && <span className="text-interactive-positive">✓</span>}
              </div>
            );
          })}
        </div>
      )}

      {thinking && activity.length === 0 && (
        <div className="animate-stage-in flex items-center gap-2.5 pl-1 text-[12px] text-text-tertiary" aria-live="polite">
          <WorkingPet className="h-5 w-5" />
          <span className="activity-shimmer-text">Orchestrating…</span>
        </div>
      )}

      {streaming && !thinking && activity.length === 0 && (
        <div className="animate-stage-in flex items-center gap-2.5 pl-1 text-[12px] text-text-tertiary" aria-live="polite">
          <WorkingPet className="h-5 w-5" />
          <span className="activity-shimmer-text">Starting agent…</span>
        </div>
      )}
    </div>
  );
}
