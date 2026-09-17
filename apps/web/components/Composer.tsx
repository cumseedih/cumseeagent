"use client";
import { useState } from "react";

export function Composer({ onSend, disabled, placeholder }: { onSend: (text: string) => void; disabled?: boolean; placeholder?: string }) {
  const [text, setText] = useState("");

  return (
    <div className="rounded-xl border border-[#1e2433] bg-[#0f131d] p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder || "Ask your agent to build, fix, or explain... (Drop files to attach)"}
        rows={3}
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[#6b7280]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            if (text.trim() && !disabled) {
              onSend(text);
              setText("");
            }
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-[#6b7280]">⌘+Enter to send • Streaming via SSE</div>
        <button
          disabled={disabled || !text.trim()}
          onClick={() => {
            if (text.trim()) {
              onSend(text);
              setText("");
            }
          }}
          className="rounded bg-[var(--primary)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
        >
          Send
        </button>
      </div>
    </div>
  );
}
