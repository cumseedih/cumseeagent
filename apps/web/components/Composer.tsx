"use client";

import { useRef, useState, type ReactNode } from "react";
import { KeyCap, cx } from "./ui";
import { IconAppsPlus, IconChevronDown, IconCloudUpload, IconSendArrow, IconStop } from "./icons";

/**
 * Prompt composer.
 * Enter sends, Shift+Enter newlines, attachments are read locally and inlined
 * as context (no upload endpoint needed yet).
 */
export function Composer({
  onSend,
  disabled,
  busy,
  onStop,
  placeholder,
  onAttach,
  footer,
}: {
  onSend: (text: string, files: { name: string; size: number; content: string }[]) => void;
  disabled?: boolean;
  busy?: boolean;
  onStop?: () => void;
  placeholder?: string;
  footer?: ReactNode;
  onAttach?: (files: { name: string; size: number; content: string }[]) => void;
}) {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; size: number; content: string }[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function ingest(list: FileList | null) {
    if (!list?.length) return;
    const next: { name: string; size: number; content: string }[] = [];
    for (const f of Array.from(list).slice(0, 5)) {
      const content = await f.text().catch(() => "");
      next.push({ name: f.name, size: f.size, content: content.slice(0, 40_000) });
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 8));
    onAttach?.(next);
  }

  function submit() {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value, attachments);
    setText("");
    setAttachments([]);
    if (taRef.current) taRef.current.style.height = "auto";
  }

  const canSend = !!text.trim() && !disabled;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        ingest(e.dataTransfer.files);
      }}
      className={cx(
        "relative w-full overflow-hidden rounded-[22px] border bg-surface-secondary shadow-[0_18px_48px_rgba(46,43,41,0.07)] transition-[border-color,box-shadow]",
        dragging ? "border-border-strong shadow-glow" : "border-border-medium"
      )}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-composer bg-surface-primary/70 text-xs text-text-tertiary">
          Drop files to attach…
        </div>
      )}

      <div className="flex w-full flex-col items-start justify-center px-4 pb-1 pt-4 md:px-5 md:pb-3 md:pt-5">
        {attachments.length > 0 && (
          <div className="mb-1.5 flex w-full flex-wrap gap-1.5 px-1">
            {attachments.map((a, idx) => (
              <span
                key={`${a.name}-${idx}`}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border-faint bg-surface-raised-tertiary px-2 py-0.5 font-mono text-[11px] text-text-tertiary"
              >
                {a.name}
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-text-muted hover:text-interactive-negative"
                  aria-label={`Remove ${a.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex w-full flex-col justify-between gap-0 md:gap-2">
          <textarea
            ref={taRef}
            value={text}
            rows={1}
            placeholder={placeholder || "Describe the task — or drop files to attach…"}
            onChange={(e) => {
              setText(e.target.value);
              const el = e.target as HTMLTextAreaElement;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-[40vh] min-h-[28px] w-full resize-none bg-transparent px-0 py-0 text-[15px] leading-relaxed text-text-primary outline-none placeholder:text-text-placeholder md:min-h-[68px] md:text-[15px]"
          />

          <div className="flex items-center justify-between gap-4">
            <div className="mr-1 flex h-8 min-w-0 items-center gap-2 md:h-8">
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => ingest(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Add files"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-interactive-active md:h-9 md:w-9"
              >
                <span className="grid place-items-center">
                  {dragging ? <IconCloudUpload className="h-[19px] w-[19px]" /> : <IconAppsPlus className="h-[19px] w-[19px]" />}
                </span>
              </button>
              <button
                type="button"
                className="hidden h-8 items-center gap-1.5 rounded-md border border-border-faint px-2 text-sm text-text-secondary transition-colors hover:bg-surface-raised-tertiary hover:text-text-primary sm:inline-flex"
                aria-label="Agent mode"
              >
                Agent
                <IconChevronDown className="h-3.5 w-3.5 text-text-muted" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="hidden items-center gap-1 text-[11px] text-text-muted md:flex">
                <KeyCap>⏎</KeyCap> send · <KeyCap>⇧⏎</KeyCap> newline
              </span>
              {busy && onStop ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop run"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-medium bg-primary text-white transition-[transform,background-color] hover:scale-[1.02] hover:bg-[hsl(var(--brand-secondary))] md:h-10 md:w-10"
                >
                  <IconStop className="h-4 w-4" />
                </button>
              ) : <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                aria-label="Send message"
                className={cx(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors md:h-10 md:w-10",
                  canSend
                    ? "border-border-medium bg-surface-raised text-interactive-active hover:bg-surface-highlight"
                    : "pointer-events-none border-border-faint text-text-muted opacity-50"
                )}
              >
                <IconSendArrow className="h-5 w-5" />
              </button>}
            </div>
          </div>
        </div>
      </div>
      {footer}
    </div>
  );
}
