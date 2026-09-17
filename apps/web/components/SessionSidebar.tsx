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
    <div className="flex h-full w-72 flex-col border-r border-[#1e2433] bg-[#0f131d]">
      <div className="p-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-widest text-[#9aa0b2]">SESSIONS</h2>
        <button onClick={onNew} className="rounded bg-[#1e2433] px-2 py-1 text-xs hover:bg-[#2a334a]">+ New</button>
      </div>
      <div className="px-3 pb-2">
        <button onClick={load} className="text-xs text-[#6ae3ff] hover:underline">↻ Refresh</button>
      </div>
      <div className="flex-1 overflow-auto px-2">
        {loading && <div className="p-3 text-sm text-[#9aa0b2]">Loading…</div>}
        {error && <div className="m-2 rounded bg-[#2a1212] p-2 text-xs text-[#ffb4b4]">{error}</div>}
        {!loading && sessions.length === 0 && !error && <div className="p-3 text-sm text-[#9aa0b2]">No sessions yet. Create one to start.</div>}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`mb-1 w-full rounded p-2 text-left text-sm hover:bg-[#1a2032] ${selectedId === s.id ? "bg-[#1a2032] border border-[#1e2433]" : ""}`}
          >
            <div className="truncate font-medium">{s.title}</div>
            <div className="text-xs text-[#9aa0b2]">{s.status} • {new Date(s.createdAt).toLocaleString()}</div>
          </button>
        ))}
      </div>
      <div className="border-t border-[#1e2433] p-3 text-xs text-[#6b7280]">
        <div>Persistent sessions • auto-saved</div>
        <div className="mt-1">Backend: <code>/api/sessions</code></div>
      </div>
    </div>
  );
}
