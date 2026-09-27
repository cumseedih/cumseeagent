"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { KeyCap, cx } from "./ui";
import { IconAppsPlus, IconChevronDown, IconCloudUpload, IconGithub, IconMicrophone, IconPaperclip, IconPlus, IconSendArrow, IconSparkle, IconStop, IconVoiceWave, IconWorkspacePreview } from "./icons";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type PluginMention = {
  type: "plugin";
  pluginId: "github" | "google-drive" | "google-docs" | "google-sheets" | "google-slides" | "gmail" | "google-calendar" | "notion" | "linear";
  displayName: string;
};
export type AgentEffort = "quick" | "standard" | "deep";

const EFFORT_OPTIONS: Array<{ id: AgentEffort; label: string; detail: string }> = [
  { id: "quick", label: "Instant", detail: "Answers right away" },
  { id: "deep", label: "Thinking", detail: "Reasons longer before answering" },
];

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
  conversationMode = false,
}: {
  onSend: (text: string, files: { name: string; size: number; content: string }[], mentions: PluginMention[], effort: AgentEffort) => void;
  disabled?: boolean;
  busy?: boolean;
  onStop?: () => void;
  placeholder?: string;
  footer?: ReactNode;
  onAttach?: (files: { name: string; size: number; content: string }[]) => void;
  onOpenConnections?: () => void;
  onOpenWorkspace?: () => void;
  conversationMode?: boolean;
}) {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; size: number; content: string }[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [mentions, setMentions] = useState<PluginMention[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [effort, setEffort] = useState<AgentEffort>("quick");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const effortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toolsOpen && !effortOpen) return;
    if (toolsOpen) {
      api.githubStatus().then((status: any) => setGithubConnected(Boolean(status?.connected))).catch(() => setGithubConnected(false));
      api.googleStatus().then((status: any) => setGoogleConnected(Boolean(status?.connected))).catch(() => setGoogleConnected(false));
    }
    function closeOnOutsideClick(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (!toolsRef.current?.contains(event.target)) setToolsOpen(false);
      if (!effortRef.current?.contains(event.target)) setEffortOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setToolsOpen(false);
        setEffortOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [toolsOpen, effortOpen]);

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
    onSend(value, attachments, mentions, effort);
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
        "premium-composer liquid-composer relative w-full border bg-surface-secondary transition-[border-color,box-shadow,transform]",
        conversationMode ? "rounded-[29px] bg-white shadow-[0_6px_18px_rgba(0,0,0,0.10)] md:rounded-[28px] md:bg-surface-secondary" : "rounded-[20px]",
        dragging ? "border-border-strong shadow-glow" : "border-border-medium"
      )}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-composer bg-surface-primary/70 text-xs text-text-tertiary">
          Drop files to attach…
        </div>
      )}

      <div className={cx("flex w-full flex-col items-start justify-center", conversationMode ? "px-[10px] pb-[8px] pt-[11px] md:px-5 md:pb-3 md:pt-5" : "px-4 pb-3 pt-4 md:px-5 md:pt-5")}>
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
            className={cx("agent-composer-input max-h-[40vh] w-full resize-none border-0 bg-transparent px-0 py-0 text-text-primary outline-none placeholder:text-[#888] focus:border-0 focus:outline-none focus:ring-0", conversationMode ? "min-h-[28px] px-0 text-[16px] leading-7 md:min-h-[68px] md:text-[15px]" : "min-h-[54px] text-[15px] leading-relaxed md:min-h-[68px]")}
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

          <div className={cx("flex items-center justify-between gap-4", conversationMode && "mt-[7px] md:mt-0")}>
            <div className="mr-1 flex h-[34px] min-w-0 items-center gap-2 md:h-8">
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
                className={cx("inline-flex items-center justify-center text-text-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-interactive-active", conversationMode ? "h-[34px] w-[34px] rounded-full border border-[#dedede] md:h-9 md:w-9" : "h-8 w-8 rounded-lg md:h-9 md:w-9")}
              >
                <span className="grid place-items-center">
                  {dragging ? <IconCloudUpload className="h-[19px] w-[19px]" /> : conversationMode ? <IconPlus className="h-5 w-5" /> : <IconAppsPlus className="h-[19px] w-[19px]" />}
                </span>
              </button>
              <div ref={toolsRef} className={cx("relative h-8 items-center md:h-9", conversationMode ? "hidden md:flex" : "flex")}>
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
                    className="liquid-popover absolute bottom-full left-0 z-40 mb-2 w-[min(320px,calc(100vw-40px))] overflow-hidden rounded-xl border border-border-medium bg-surface-floating text-left shadow-[0_12px_36px_rgba(24,24,24,0.14)] animate-composer-popover"
                  >
                    <div className="border-b border-border-faint px-3.5 py-2.5">
                      <div className="mb-2 text-[13px] font-medium text-text-secondary">Agent effort</div>
                      <div className="grid grid-cols-2 gap-1">
                        {EFFORT_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={effort === option.id}
                            onClick={() => setEffort(option.id)}
                            className={cx("rounded-lg px-2 py-1.5 text-left transition-colors", effort === option.id ? "bg-surface-raised text-text-primary shadow-sm" : "text-text-muted hover:bg-surface-raised/70")}
                          >
                            <span className="block text-[12px] font-medium">{option.label}</span>
                            <span className="block text-[10px] leading-tight opacity-75">{option.detail}</span>
                          </button>
                        ))}
                      </div>
                    </div>
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

            <div className="flex items-center gap-[6px] md:gap-1.5">
              {conversationMode && (
                <div ref={effortRef} className="relative">
                  <button type="button" aria-label="Choose agent effort" aria-expanded={effortOpen} onClick={() => setEffortOpen((open) => !open)} className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#dedede] bg-white px-3 text-[13px] font-medium text-[#222] transition-colors hover:bg-[#f1f1f1] md:h-9 md:border-border-faint md:bg-surface-secondary md:text-text-secondary">
                    {EFFORT_OPTIONS.find((option) => option.id === effort)?.label}
                    <IconChevronDown className={cx("h-3.5 w-3.5 transition-transform", effortOpen && "rotate-180")} />
                  </button>
                  {effortOpen && (
                    <div className="liquid-popover absolute bottom-full right-0 z-50 mb-[9px] w-[231px] overflow-hidden rounded-[11px] border border-[#ededed] bg-white py-1 shadow-[0_4px_12px_rgba(0,0,0,0.18)] animate-composer-popover md:w-[270px] md:rounded-2xl md:border-border-medium md:bg-surface-floating">
                      {EFFORT_OPTIONS.map((option) => (
                        <button key={option.id} type="button" aria-pressed={effort === option.id} onClick={() => { setEffort(option.id); setEffortOpen(false); }} className="flex w-full items-center gap-3 border-b border-[#efefef] px-[15px] py-[9px] text-left transition-colors last:border-b-0 hover:bg-[#f5f5f5] md:px-4 md:py-3">
                          <span className="flex-1"><span className="block text-[14px] font-medium text-[#222]">{option.label}</span><span className="mt-0.5 block text-[11px] text-[#888] md:text-[12px]">{option.detail}</span></span>
                          {effort === option.id && <span aria-hidden="true" className="text-[16px] text-[#222]">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <span className="hidden items-center gap-1 text-[11px] text-text-muted md:flex">
                <KeyCap>⏎</KeyCap> send · <KeyCap>⇧⏎</KeyCap> newline
              </span>
              {conversationMode && (
                <button type="button" onClick={() => taRef.current?.focus()} aria-label="Voice input" className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#dedede] bg-white text-[#222] transition-colors hover:bg-[#f1f1f1] md:hidden">
                  <IconMicrophone className="h-[19px] w-[19px]" />
                </button>
              )}
              <button
                type="button"
                onClick={onOpenWorkspace}
                aria-label="Open workspace files"
                title="Open workspace files"
                className={cx("h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-[background-color,color,transform] duration-150 hover:bg-surface-raised hover:text-interactive-active active:scale-[0.96] md:h-9 md:w-9", conversationMode ? "hidden md:inline-flex" : "inline-flex")}
              >
                <IconWorkspacePreview className="h-[19px] w-[19px]" />
              </button>
              {busy && onStop ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop run"
                  className={cx("inline-flex items-center justify-center border bg-primary text-white transition-[transform,background-color] hover:scale-[1.02] hover:bg-[hsl(var(--brand-secondary))]", conversationMode ? "h-[34px] w-[34px] rounded-full border-transparent md:h-10 md:w-10" : "h-8 w-8 rounded-lg border-border-medium md:h-10 md:w-10")}
                >
                  <IconStop className="h-4 w-4" />
                </button>
              ) : <button
                type="button"
                onClick={() => canSend ? submit() : taRef.current?.focus()}
                aria-label={canSend ? "Send message" : "Compose a message"}
                className={cx(
                  "inline-flex items-center justify-center border transition-colors",
                  conversationMode
                    ? "h-[34px] w-[34px] rounded-full border-transparent bg-[#0863d9] text-white hover:bg-[#1c6fdc] md:h-10 md:w-10 md:rounded-md"
                    : canSend
                      ? "h-8 w-8 rounded-md border-border-medium bg-surface-raised text-interactive-active hover:bg-surface-highlight md:h-10 md:w-10"
                      : "pointer-events-none h-8 w-8 rounded-md border-border-faint text-text-muted opacity-50 md:h-10 md:w-10"
                )}
              >
                {canSend ? <IconSendArrow className="h-5 w-5" /> : conversationMode ? <IconVoiceWave className="h-[18px] w-[18px]" /> : <IconSendArrow className="h-5 w-5" />}
              </button>}
            </div>
          </div>
        </div>
      </div>
      {footer}
    </div>
  );
}
