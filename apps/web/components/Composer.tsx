"use client";
import { useState } from "react";

export function Composer({ onSend, disabled, placeholder }: { onSend: (text: string) => void; disabled?: boolean; placeholder?: string }) {
  const [text, setText] = useState("");

  return (
    <div className="rounded-xl border border-[#e1dedb] bg-white p-4 shadow-[0_12px_35px_rgba(46,43,41,0.08)] transition focus-within:border-[#ffc800]">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder || "Ask your agent to build, fix, or explain... (Drop files to attach)"}
        rows={2}
        className="w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 outline-none placeholder:text-[#6f6862]"
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
        <div className="text-[10px] text-[#6f6862]">⌘ Enter to send · Delvin streams progress live</div>
        <button
          disabled={disabled || !text.trim()}
          onClick={() => {
            if (text.trim()) {
              onSend(text);
              setText("");
            }
          }}
          className="rounded-lg bg-[#2e2b29] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#6f6862] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
