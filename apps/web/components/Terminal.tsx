"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { cx } from "./ui";
import { IconShield, IconTerminal } from "./icons";

type Line = { kind: "cmd" | "out" | "err" | "sys"; text: string };

/**
 * Workspace terminal.
 * Every command is executed by the backend inside the session workspace under
 * the agent user, path-validated, time-limited and audit-logged; risky commands
 * come back as `approval_required` and are surfaced as info lines instead of
 * running silently.
 */
export function Terminal({ sessionId, cwd }: { sessionId: string; cwd?: string }) {
  const [command, setCommand] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { kind: "sys", text: "Workspace shell · commands run on the server as the agent user · audit logged" },
  ]);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.listTerminal(sessionId);
        const commands = data.commands || data.terminalCommands || [];
        if (cancelled || !commands.length) return;
        setLines((prev) => [
          ...prev,
          { kind: "sys", text: `${commands.length} previous command${commands.length === 1 ? "" : "s"} restored from history` },
          ...commands.slice(-12).flatMap((c: any): Line[] => {
            const out: Line[] = [{ kind: "cmd", text: c.command }];
            if (c.output) out.push({ kind: c.exitCode ? "err" : "out", text: String(c.output).slice(-4000) });
            return out;
          }),
        ]);
      } catch {
        /* history is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function run() {
    const cmd = command.trim();
    if (!cmd || running) return;
    setLines((prev) => [...prev, { kind: "cmd", text: cmd }]);
    setHistory((prev) => [...prev, cmd]);
    setHistIdx(-1);
    setCommand("");
    setRunning(true);
    try {
      const res = await api.runCommand(sessionId, { command: cmd, cwd: cwd || undefined });
      if (res.status === "approval_required") {
        setLines((prev) => [
          ...prev,
          {
            kind: "sys",
            text: `Approval required (${res.toolCall?.riskLevel || res.riskLevel || "elevated"} risk) — approve it in the transcript to run.`,
          },
        ]);
      } else {
        const result = res.result || res.terminalCommand || res;
        const out = result.stdout ?? result.output ?? "";
        const err = result.stderr ?? "";
        if (out) setLines((prev) => [...prev, { kind: "out", text: String(out) }]);
        if (err) setLines((prev) => [...prev, { kind: "err", text: String(err) }]);
        if (!out && !err)
          setLines((prev) => [...prev, { kind: "out", text: `exit ${result.exitCode ?? 0} · no output` }]);
      }
    } catch (e: any) {
      setLines((prev) => [...prev, { kind: "err", text: e.message || "Command failed" }]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[12px] leading-[1.6]">
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-words">
            {l.kind === "cmd" && (
              <span className="text-text-secondary">
                <span className="text-highlight">❯</span> {l.text}
              </span>
            )}
            {l.kind === "out" && <span className="text-text-tertiary">{l.text}</span>}
            {l.kind === "err" && <span className="text-interactive-negative">{l.text}</span>}
            {l.kind === "sys" && (
              <span className="text-text-muted">
                <span className="mr-1 text-interactive-link">›</span>
                {l.text}
              </span>
            )}
          </div>
        ))}
        {running && (
          <div className="flex items-center gap-2 text-text-muted">
            <span className="h-1.5 w-1.5 animate-caret rounded-full bg-interactive-warning" />
            running…
          </div>
        )}
      </div>

      <div className="border-t border-border-faint p-2">
        <div className="flex h-8 items-center gap-2 rounded-sm border border-border-faint bg-surface-floating px-2 focus-within:border-border-medium">
          <IconTerminal className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") run();
              if (e.key === "ArrowUp") {
                e.preventDefault();
                const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
                if (history[next] !== undefined) {
                  setHistIdx(next);
                  setCommand(history[next]);
                }
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (histIdx >= 0 && histIdx < history.length - 1) {
                  const next = histIdx + 1;
                  setHistIdx(next);
                  setCommand(history[next]);
                } else {
                  setHistIdx(-1);
                  setCommand("");
                }
              }
            }}
            placeholder={running ? "running…" : "ls -la  ·  pnpm test  ·  git status"}
            disabled={running}
            spellCheck={false}
            className={cx(
              "h-full w-full bg-transparent font-mono text-[12px] text-text-primary outline-none placeholder:text-text-muted",
              running && "opacity-60"
            )}
          />
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[10px] text-text-muted">
          <IconShield className="h-3 w-3" />
          Sandboxed workspace · path-validated · 30s timeout · 1 MB output cap · every command audit-logged
        </p>
      </div>
    </div>
  );
}
