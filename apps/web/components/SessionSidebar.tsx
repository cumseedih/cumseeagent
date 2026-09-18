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
    <div className="delvin-sidebar flex h-full w-[260px] shrink-0 flex-col border-r border-[#1e2433] bg-[#0d121b]">
      <div className="flex items-center justify-between border-b border-[#1b2635] p-4">
        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-[#9bb85a] shadow-[0_0_12px_#9bb85a]" /><h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c4cbd7]">Delvin Agent</h2></div>
        <button aria-label="Create new session" onClick={onNew} className="rounded-lg border border-[#2a3a4b] bg-[#14202d] px-2.5 py-1.5 text-xs text-[#d6e0eb] transition hover:border-[#6ae3ff] hover:text-white">＋</button>
      </div>
      <div className="px-3 pb-2">
        <button onClick={load} className="text-[11px] text-[#77849a] transition hover:text-[#6ae3ff]">Recent sessions <span className="ml-1">↻</span></button>
      </div>
      <div className="flex-1 overflow-auto px-2">
        {loading && <div className="p-3 text-sm text-[#9aa0b2]">Loading…</div>}
        {error && <div className="m-2 rounded bg-[#2a1212] p-2 text-xs text-[#ffb4b4]">{error}</div>}
        {!loading && sessions.length === 0 && !error && <div className="p-3 text-sm text-[#9aa0b2]">No sessions yet. Create one to start.</div>}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`mb-1 w-full rounded-xl border p-3 text-left text-sm transition hover:border-[#2c4051] hover:bg-[#14202d] ${selectedId === s.id ? "border-[#385164] bg-[#172536] shadow-[inset_2px_0_#6ae3ff]" : "border-transparent"}`}
          >
            <div className="truncate font-medium">{s.title}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-[#718096]">{s.status} · {new Date(s.createdAt).toLocaleDateString()}</div>
          </button>
        ))}
      </div>
      <div className="border-t border-[#1e2433] p-4 text-[10px] leading-5 text-[#66758a]">
        <div>Persistent workspace</div>
        <div>Delvin Agent · secure session</div>
      </div>
    </div>
  );
}
