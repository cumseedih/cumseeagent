"use client";
import { useState } from "react";
import { api } from "../lib/api";

export function Terminal({ sessionId }: { sessionId: string }) {
  const [command, setCommand] = useState("pwd && ls -la");
  const [cwd, setCwd] = useState("");
  const [output, setOutput] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await api.runCommand(sessionId, { command, cwd: cwd || undefined });
      // If approval required, show
      if (res.status === "approval_required") {
        setOutput({ approval_required: true, ...res });
      } else {
        setOutput(res.result || res.terminalCommand || res);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded border border-[#1e2433] bg-black p-3 font-mono text-xs">
      <div className="mb-2 flex gap-2">
        <input value={command} onChange={(e) => setCommand(e.target.value)} className="flex-1 rounded bg-[#0f131d] px-2 py-1 text-xs outline-none" placeholder="e.g. ls -la" />
        <input value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="cwd (optional)" className="w-40 rounded bg-[#0f131d] px-2 py-1 text-xs outline-none" />
        <button onClick={run} disabled={running} className="rounded bg-white px-3 py-1 text-black disabled:opacity-50">
          {running ? "Running…" : "Run"}
        </button>
      </div>
      {error && <div className="rounded bg-[#2a1212] p-2 text-[#ffb4b4]">{error}</div>}
      {output && (
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words bg-[#0b0e14] p-2 text-[#a7f3d0]">
          {JSON.stringify(output, null, 2).slice(0, 8000)}
        </pre>
      )}
      <div className="mt-2 text-[10px] text-[#6b7280]">Workspace-isolated • path traversal & injection protected • timeout 30s • output 1MB • audit logged</div>
    </div>
  );
}
