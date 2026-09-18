"use client";

import { Markdown } from "../lib/markdown";
import { BRANDING } from "../branding.config";
import { Mark } from "./Wordmark";
import { cx, Skeleton } from "./ui";

type Message = {
  id: string;
  role: string;
  content: string;
  status?: string;
  createdAt?: string;
  selectedModel?: string;
};

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
}: {
  messages: Message[];
  streaming?: boolean;
  thinking?: boolean;
}) {
  if (!messages.length) return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {messages.map((m) => {
        const isUser = m.role === "user";
        if (isUser) {
          return (
            <div key={m.id} className="animate-fade flex justify-end">
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
          <div key={m.id} className="group animate-fade flex gap-3">
            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border-faint bg-surface-secondary">
              <Mark className="h-3.5 w-3.5 text-text-tertiary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2 text-[11px] text-text-muted">
                <span className="font-medium text-text-tertiary">{BRANDING.PRODUCT_NAME}</span>
                {m.selectedModel && <span className="font-mono">{m.selectedModel}</span>}
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

      {thinking && (
        <div className="flex gap-3">
          <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border-faint bg-surface-secondary">
            <Mark className="h-3.5 w-3.5 text-text-tertiary" />
          </div>
          <div className="w-full max-w-md space-y-2 pt-1">
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
            <span className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
              <span className="h-1.5 w-1.5 animate-caret rounded-full bg-interactive-warning" />
              Working…
            </span>
          </div>
        </div>
      )}

      {streaming && !thinking && (
        <div className="flex items-center gap-1.5 pl-10 text-[11px] text-text-muted">
          <span className="h-1.5 w-1.5 animate-caret rounded-full bg-highlight" />
          Streaming…
        </div>
      )}
    </div>
  );
}
