"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function SessionSidebar({ selectedId, onSelect, onNew }: { selectedId?: string; onSelect: (id: string) => void; onNew: () => void }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listSessions();
      setSessions(data.sessions || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="delvin-sidebar flex h-full w-[280px] shrink-0 flex-col border-r border-[#e1dedb] bg-white">
      <div className="flex items-center justify-between border-b border-[#e1dedb] p-4">
        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-[#ffc800]" /><h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2e2b29]">Delvin Agent</h2></div>
        <button aria-label="Create new session" onClick={onNew} className="rounded-lg border border-[#e1dedb] bg-[#f7f3ef] px-2.5 py-1.5 text-xs text-[#2e2b29] transition hover:border-[#ffc800] hover:bg-[#f0ebe5]">＋</button>
      </div>
      <div className="px-3 pb-2">
        <button onClick={load} className="text-[11px] uppercase tracking-[0.14em] text-[#6f6862] transition hover:text-[#2e2b29]">Recent sessions <span className="ml-1">↻</span></button>
      </div>
      <div className="flex-1 overflow-auto px-2">
        {loading && <div className="p-3 text-sm text-[#6f6862]">Loading…</div>}
        {error && <div className="m-2 rounded bg-[#f0ebe5] p-2 text-xs text-[#b42318]">{error}</div>}
        {!loading && sessions.length === 0 && !error && <div className="p-3 text-sm text-[#6f6862]">No sessions yet. Create one to start.</div>}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`mb-1 w-full rounded-lg border p-3 text-left text-sm transition hover:border-[#e1dedb] hover:bg-[#f7f3ef] ${selectedId === s.id ? "border-[#e1dedb] bg-[#f0ebe5] shadow-[inset_3px_0_#ffc800]" : "border-transparent"}`}
          >
            <div className="truncate font-medium">{s.title}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-[#6f6862]">{s.status} · {new Date(s.createdAt).toLocaleDateString()}</div>
          </button>
        ))}
      </div>
      <div className="border-t border-[#e5e7eb] p-4 text-[10px] leading-5 text-[#6f6862]">
        <div>Persistent workspace</div>
        <div>Delvin Agent · secure session</div>
      </div>
    </div>
  );
}
