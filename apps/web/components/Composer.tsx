"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { KeyCap, cx } from "./ui";
import { IconAppsPlus, IconChevronDown, IconCloudUpload, IconGithub, IconPaperclip, IconSendArrow, IconSparkle, IconStop, IconWorkspacePreview } from "./icons";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type PluginMention = {
  type: "plugin";
  pluginId: "github" | "google-drive" | "google-docs" | "google-sheets" | "google-slides" | "gmail" | "google-calendar" | "notion" | "linear";
  displayName: string;
};

const PLUGINS: Array<PluginMention & { mark: string; color: string; connection: "github" | "google" | null }> = [
  { type: "plugin", pluginId: "google-drive", displayName: "Google Drive", mark: "D", color: "#4285F4", connection: "google" },
  { type: "plugin", pluginId: "google-docs", displayName: "Google Docs", mark: "D", color: "#4285F4", connection: "google" },
  { type: "plugin", pluginId: "google-sheets", displayName: "Google Sheets", mark: "S", color: "#34A853", connection: "google" },
  { type: "plugin", pluginId: "google-slides", displayName: "Google Slides", mark: "S", color: "#FBBC04", connection: "google" },
  { type: "plugin", pluginId: "gmail", displayName: "Gmail", mark: "M", color: "#EA4335", connection: "google" },
  { type: "plugin", pluginId: "google-calendar", displayName: "Google Calendar", mark: "31", color: "#4285F4", connection: "google" },
  { type: "plugin", pluginId: "github", displayName: "GitHub", mark: "GH", color: "#24292F", connection: "github" },
  { type: "plugin", pluginId: "notion", displayName: "Notion", mark: "N", color: "#111111", connection: null },
  { type: "plugin", pluginId: "linear", displayName: "Linear", mark: "L", color: "#5E6AD2", connection: null },
];

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
  onOpenConnections,
  onOpenWorkspace,
  footer,
}: {
  onSend: (text: string, files: { name: string; size: number; content: string }[], mentions: PluginMention[]) => void;
  disabled?: boolean;
  busy?: boolean;
  onStop?: () => void;
  placeholder?: string;
  footer?: ReactNode;
  onAttach?: (files: { name: string; size: number; content: string }[]) => void;
  onOpenConnections?: () => void;
  onOpenWorkspace?: () => void;
}) {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; size: number; content: string }[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [mentions, setMentions] = useState<PluginMention[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toolsOpen) return;
    api.githubStatus().then((status: any) => setGithubConnected(Boolean(status?.connected))).catch(() => setGithubConnected(false));
    api.googleStatus().then((status: any) => setGoogleConnected(Boolean(status?.connected))).catch(() => setGoogleConnected(false));
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !toolsRef.current?.contains(event.target)) setToolsOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setToolsOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [toolsOpen]);

  async function ingest(list: FileList | null) {
    if (!list?.length) return;
    const next: { name: string; size: number; content: string }[] = [];
    const files = Array.from(list);
    const tooLarge = files.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooLarge) {
      setAttachmentError(`${tooLarge.name} is over the 25 MB per-file limit.`);
      return;
    }
    setAttachmentError(null);
    for (const f of files.slice(0, 5)) {
      const content = await f.text().catch(() => "");
      next.push({ name: f.name, size: f.size, content: content.slice(0, 40_000) });
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 8));
    onAttach?.(next);
  }

  function submit() {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value, attachments, mentions);
    setText("");
    setAttachments([]);
    setMentions([]);
    if (taRef.current) taRef.current.style.height = "auto";
  }

  const canSend = !!text.trim() && !disabled;
  const mentionMatch = text.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = mentionMatch?.[1]?.toLowerCase() || "";
  const mentionOptions = mentionMatch
    ? PLUGINS.filter((plugin) => !mentions.some((item) => item.pluginId === plugin.pluginId) && plugin.displayName.toLowerCase().includes(mentionQuery))
    : [];

  function chooseMention(plugin: (typeof PLUGINS)[number]) {
    const connected = plugin.connection === "github" ? githubConnected : plugin.connection === "google" ? googleConnected : false;
    if (!connected) {
      setToolsOpen(false);
      onOpenConnections?.();
      return;
    }
    setMentions((current) => [...current, { type: "plugin", pluginId: plugin.pluginId, displayName: plugin.displayName }]);
    setText((current) => current.replace(/(?:^|\s)@[^\s@]*$/, (value) => value.startsWith(" ") ? " " : ""));
    requestAnimationFrame(() => taRef.current?.focus());
  }

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
        "relative w-full rounded-[18px] border bg-surface-secondary shadow-[0_10px_32px_rgba(46,43,41,0.035)] transition-[border-color,box-shadow]",
        dragging ? "border-border-strong shadow-glow" : "border-border-medium"
      )}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-composer bg-surface-primary/70 text-xs text-text-tertiary">
          Drop files to attach…
        </div>
      )}

      <div className="flex w-full flex-col items-start justify-center px-4 pb-3 pt-4 md:px-5 md:pb-3 md:pt-5">
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
        {attachmentError && (
          <p role="alert" className="mb-2 px-1 text-xs text-interactive-negative">{attachmentError}</p>
        )}
        {mentions.length > 0 && (
          <div className="mb-2 flex w-full flex-wrap gap-1.5 px-1">
            {mentions.map((mention) => {
              const plugin = PLUGINS.find((item) => item.pluginId === mention.pluginId)!;
              return <span key={mention.pluginId} className="inline-flex items-center gap-1.5 rounded-md border border-border-faint bg-surface-raised px-2 py-1 text-xs text-text-secondary">
                <span className="grid h-4 min-w-4 place-items-center text-[9px] font-bold" style={{ color: plugin.color }}>{plugin.mark}</span>
                {mention.displayName}
                <button type="button" aria-label={`Remove ${mention.displayName}`} onClick={() => setMentions((items) => items.filter((item) => item.pluginId !== mention.pluginId))} className="ml-0.5 text-text-muted hover:text-text-primary">×</button>
              </span>;
            })}
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
            className="agent-composer-input max-h-[40vh] min-h-[54px] w-full resize-none border-0 bg-transparent px-0 py-0 text-[15px] leading-relaxed text-text-primary outline-none placeholder:text-text-placeholder focus:border-0 focus:outline-none focus:ring-0 md:min-h-[68px] md:text-[15px]"
          />
          {mentionOptions.length > 0 && (
            <div role="listbox" aria-label="Available integrations" className="absolute bottom-[58px] left-4 z-30 w-[min(300px,calc(100%-32px))] overflow-hidden rounded-xl border border-border-medium bg-surface-floating py-1 shadow-[0_12px_36px_rgba(24,24,24,0.14)] md:bottom-[64px] md:left-5">
              {mentionOptions.map((plugin) => {
                const connected = plugin.connection === "github" ? githubConnected : plugin.connection === "google" ? googleConnected : false;
                return <button key={plugin.pluginId} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseMention(plugin)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-raised">
                  <span className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold" style={{ color: plugin.color }}>{plugin.mark}</span>
                  <span className="flex-1 text-sm text-text-primary">{plugin.displayName}</span>
                  <span className="text-[11px] text-text-muted">{connected ? "Connected" : "Connect"}</span>
                </button>;
              })}
            </div>
          )}

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
              <div ref={toolsRef} className="relative flex h-8 items-center md:h-9">
                <button
                  type="button"
                  aria-label="Open connections and tools"
                  aria-expanded={toolsOpen}
                  aria-controls="composer-tools-menu"
                  onClick={() => setToolsOpen((open) => !open)}
                  className={cx(
                    "inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-text-secondary transition-[background-color,color,transform] duration-150 hover:bg-surface-raised hover:text-interactive-active active:scale-[0.96] md:h-9",
                    toolsOpen && "bg-surface-raised text-interactive-active"
                  )}
                >
                  <IconSparkle className="h-[19px] w-[19px]" />
                  <IconChevronDown className={cx("h-3.5 w-3.5 transition-transform", toolsOpen && "rotate-180")} />
                </button>
                {toolsOpen && (
                  <div
                    id="composer-tools-menu"
                    role="dialog"
                    aria-label="Connections and tools"
                    className="absolute bottom-full left-0 z-40 mb-2 w-[min(320px,calc(100vw-40px))] overflow-hidden rounded-xl border border-border-medium bg-surface-floating text-left shadow-[0_12px_36px_rgba(24,24,24,0.14)] animate-composer-popover"
                  >
                    <div className="border-b border-border-faint px-3.5 py-2.5 text-[13px] font-medium text-text-secondary">Connections</div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={githubConnected}
                      aria-label={`GitHub ${githubConnected ? "connected" : "not connected"}; open connection settings`}
                      onClick={() => { setToolsOpen(false); onOpenConnections?.(); }}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-raised"
                    >
                      <IconGithub className="h-5 w-5 text-text-secondary" />
                      <span className="flex-1 text-sm text-text-primary">GitHub</span>
                      <span className={cx("relative inline-flex h-6 w-11 items-center rounded-full px-1 transition-colors", githubConnected ? "bg-interactive-positive" : "bg-surface-skeleton")} aria-hidden="true">
                        <span className={cx("h-4 w-4 rounded-full bg-white shadow-sm transition-transform", githubConnected && "translate-x-5")} />
                      </span>
                      <span className="sr-only">Open GitHub connection settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setToolsOpen(false); fileRef.current?.click(); }}
                      className="flex w-full items-center gap-3 border-t border-border-faint px-3.5 py-3 text-left transition-colors hover:bg-surface-raised"
                    >
                      <span className="flex-1">
                        <span className="block text-sm text-text-primary">Add files</span>
                        <span className="mt-0.5 block text-[11px] text-text-muted">Up to 25 MB per file</span>
                      </span>
                      <IconPaperclip className="h-5 w-5 text-text-secondary" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="hidden items-center gap-1 text-[11px] text-text-muted md:flex">
                <KeyCap>⏎</KeyCap> send · <KeyCap>⇧⏎</KeyCap> newline
              </span>
              <button
                type="button"
                onClick={onOpenWorkspace}
                aria-label="Open workspace files"
                title="Open workspace files"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-[background-color,color,transform] duration-150 hover:bg-surface-raised hover:text-interactive-active active:scale-[0.96] md:h-9 md:w-9"
              >
                <IconWorkspacePreview className="h-[19px] w-[19px]" />
              </button>
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
