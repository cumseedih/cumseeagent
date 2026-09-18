"use client";
import { useState } from "react";

export function Composer({ onSend, disabled, placeholder }: { onSend: (text: string) => void; disabled?: boolean; placeholder?: string }) {
  const [text, setText] = useState("");

  return (
    <div className="rounded-2xl border border-[#29384a] bg-[#111923] p-3 shadow-[0_12px_45px_rgba(0,0,0,0.22)] transition focus-within:border-[#46657a]">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder || "Ask your agent to build, fix, or explain... (Drop files to attach)"}
        rows={2}
        className="w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 outline-none placeholder:text-[#68768a]"
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
        <div className="text-[10px] text-[#68768a]">⌘ Enter to send · Delvin streams progress live</div>
        <button
          disabled={disabled || !text.trim()}
          onClick={() => {
            if (text.trim()) {
              onSend(text);
              setText("");
            }
          }}
          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(14,165,233,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
