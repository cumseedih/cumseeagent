"use client";

import { Fragment, useMemo, useState } from "react";
import { Markdown } from "../lib/markdown";
import { IconCopy, IconShare, IconThumbDown, IconThumbUp } from "./icons";
import { WorkingPet } from "./Pet";
import { cx } from "./ui";
import { CommandActivityList, commandActivitiesFromEvents, type AgentEvent } from "./CommandActivity";

type Message = {
  id: string;
  role: string;
  content: string;
  status?: string;
  createdAt?: string;
};

function activityLabel(event: AgentEvent) {
  const payload = event.payload || {};
  if (payload.toolName === "terminal" || payload.command || payload.arguments?.command) return null;
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
  let latestUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      latestUserIndex = index;
      break;
    }
  }
  const latestUserAt = latestUserIndex >= 0 && messages[latestUserIndex]?.createdAt
    ? Date.parse(messages[latestUserIndex].createdAt as string)
    : 0;
  const commandActivities = useMemo(
    () => commandActivitiesFromEvents(events).filter((activity) => !latestUserAt || !activity.startedAt || Date.parse(activity.startedAt) >= latestUserAt).slice(-8),
    [events, latestUserAt]
  );
  if (!messages.length) return null;
  const answerIndex = messages.findIndex((message, index) => index > latestUserIndex && message.role === "assistant");
  const commandBlock = <CommandActivityList activities={commandActivities} />;

  const activity = events
    .map((event) => ({ event, label: activityLabel(event) }))
    .filter((item): item is { event: AgentEvent; label: string } => Boolean(item.label))
    .slice(-5);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-[19px] md:gap-7">
      {messages.map((m, messageIndex) => {
        const isUser = m.role === "user";
        if (isUser) {
          return (
            <Fragment key={m.id}>
              {messageIndex === answerIndex && commandBlock}
              <div className="animate-message-in flex justify-end">
                <div className="group max-w-[82%] rounded-[19px] bg-[#f1f1f3] px-[15px] py-[8px] md:max-w-[75%] md:rounded-[22px] md:bg-surface-raised/70 md:px-4 md:py-2.5 md:shadow-[inset_0_0_0_1px_hsl(var(--border-faint))]">
                  <p className="whitespace-pre-wrap break-words text-[14px] leading-[19px] text-[#111] md:text-[15px] md:leading-relaxed md:text-text-primary">{m.content}</p>
                </div>
              </div>
            </Fragment>
          );
        }

        const vote = rated[m.id];
        return (
          <Fragment key={m.id}>
            {messageIndex === answerIndex && commandBlock}
            <article className="animate-stage-in min-w-0">
              <WorkingPet className="ml-[5px] h-[22px] w-[22px] md:h-6 md:w-6" />
              <div className="mt-[18px] min-w-0 text-[14px] leading-[1.55] text-[#353535] [&_.agent-md]:text-[#353535] md:mt-4 md:text-[15px] md:leading-[1.75] md:text-text-primary md:[&_.agent-md]:text-text-secondary"><Markdown text={m.content} /></div>
              <div className="ml-[11px] mt-[17px] flex items-center gap-[21px] text-[#777] md:ml-0 md:mt-3 md:gap-2 md:text-text-muted" aria-label="Response actions">
              <button type="button" aria-label="Good response" aria-pressed={vote === "up"} onClick={() => setRated((current) => ({ ...current, [m.id]: current[m.id] === "up" ? undefined : "up" }))} className={cx("grid h-5 w-5 place-items-center rounded-full transition-colors hover:text-[#222] md:h-9 md:w-9 md:hover:bg-surface-raised md:hover:text-text-primary", vote === "up" && "text-[#222] md:bg-surface-raised md:text-text-primary")}><IconThumbUp className="h-[20px] w-[20px]" /></button>
              <button type="button" aria-label="Bad response" aria-pressed={vote === "down"} onClick={() => setRated((current) => ({ ...current, [m.id]: current[m.id] === "down" ? undefined : "down" }))} className={cx("grid h-5 w-5 place-items-center rounded-full transition-colors hover:text-[#222] md:h-9 md:w-9 md:hover:bg-surface-raised md:hover:text-text-primary", vote === "down" && "text-[#222] md:bg-surface-raised md:text-text-primary")}><IconThumbDown className="h-[20px] w-[20px]" /></button>
              <button type="button" aria-label="Copy response" onClick={() => navigator.clipboard?.writeText(m.content)} className="grid h-5 w-5 place-items-center rounded-full transition-colors hover:text-[#222] md:h-9 md:w-9 md:hover:bg-surface-raised md:hover:text-text-primary"><IconCopy className="h-[19px] w-[19px]" /></button>
              <button type="button" aria-label="Share response" onClick={async () => {
                if (navigator.share) await navigator.share({ text: m.content }).catch(() => undefined);
                else await navigator.clipboard?.writeText(m.content);
              }} className="grid h-5 w-5 place-items-center rounded-full transition-colors hover:text-[#222] md:h-9 md:w-9 md:hover:bg-surface-raised md:hover:text-text-primary"><IconShare className="h-[19px] w-[19px]" /></button>
              </div>
            </article>
          </Fragment>
        );
      })}

      {answerIndex === -1 && commandBlock}

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
