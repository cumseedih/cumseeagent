"use client";

import { Markdown } from "../lib/markdown";
import { BRANDING } from "../branding.config";
import { Mark } from "./Wordmark";
import { cx } from "./ui";

type Message = {
  id: string;
  role: string;
  content: string;
  status?: string;
  createdAt?: string;
  selectedModel?: string;
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
  events = [],
}: {
  messages: Message[];
  streaming?: boolean;
  thinking?: boolean;
  events?: AgentEvent[];
}) {
  if (!messages.length) return null;

  const activity = events
    .map((event) => ({ event, label: activityLabel(event) }))
    .filter((item): item is { event: AgentEvent; label: string } => Boolean(item.label))
    .slice(-5);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {messages.map((m) => {
        const isUser = m.role === "user";
        if (isUser) {
          return (
            <div key={m.id} className="animate-message-in flex justify-end">
              <div className="group max-w-[85%] rounded-panel rounded-br-sm border border-border-faint bg-surface-raised/50 px-3.5 py-2.5">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">{m.content}</p>
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

        return (
          <div key={m.id} className="group animate-stage-in flex gap-3">
            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border-faint bg-surface-secondary">
              <Mark className="h-3.5 w-3.5 text-text-tertiary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2 text-[11px] text-text-muted">
                <span className="font-medium text-text-tertiary">{BRANDING.PRODUCT_NAME}</span>
                {m.status && m.status !== "completed" && (
                  <span
                    className={cx(
                      "rounded-full border px-1.5",
                      m.status === "failed"
                        ? "border-interactive-negative/40 text-interactive-negative"
                        : "border-border-faint text-text-muted"
                    )}
                  >
                    {m.status}
                  </span>
                )}
                {timeOf(m.createdAt) && <span className="ml-auto">{timeOf(m.createdAt)}</span>}
                <button
                  onClick={() => navigator.clipboard?.writeText(m.content)}
                  className="opacity-0 transition-opacity hover:text-text-tertiary group-hover:opacity-100"
                >
                  Copy
                </button>
              </div>
              <Markdown text={m.content} />
            </div>
          </div>
        );
      })}

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
                <span
                  className={cx(
                    "h-2 w-2 shrink-0 rounded-full",
                    failed
                      ? "bg-interactive-negative"
                      : done
                        ? "bg-interactive-positive"
                        : current
                          ? "animate-orchestrate bg-primary"
                          : "bg-[hsl(var(--brand-secondary))]"
                  )}
                />
                <span className={cx(current && !failed && "activity-shimmer-text")}>{label}</span>
                {done && <span className="text-interactive-positive">✓</span>}
              </div>
            );
          })}
        </div>
      )}

      {thinking && activity.length === 0 && (
        <div className="animate-stage-in flex items-center gap-2.5 pl-1 text-[12px] text-text-tertiary" aria-live="polite">
          <span className="h-2 w-2 animate-orchestrate rounded-full bg-primary" />
          <span className="activity-shimmer-text">Orchestrating…</span>
        </div>
      )}

      {streaming && !thinking && activity.length === 0 && (
        <div className="animate-stage-in flex items-center gap-2.5 pl-1 text-[12px] text-text-tertiary" aria-live="polite">
          <span className="h-2 w-2 animate-orchestrate rounded-full bg-primary" />
          <span className="activity-shimmer-text">Starting agent…</span>
        </div>
      )}
    </div>
  );
}
