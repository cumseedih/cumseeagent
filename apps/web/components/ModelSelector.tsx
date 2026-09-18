"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function ModelSelector({ value, onChange }: { value: string; onChange: (v: string, providerId: string) => void }) {
  const [models, setModels] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const m = await api.listModels();
        const p = await api.listProviders();
        setModels(m.models || []);
        setProviders(p.providers || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-xs text-[#6f6862]">Loading models…</div>;
  if (error) return <div className="text-xs text-[#b42318]">Models unavailable: {error}</div>;

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => {
          const modelId = e.target.value;
          const m = models.find((x) => x.id === modelId);
          onChange(modelId, m?.providerId || "mock");
        }}
        className="rounded border border-[#e5e7eb] bg-white px-2 py-1.5 text-sm"
      >
        <option value="">Select model</option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.displayName || m.name} ({m.providerId})
          </option>
        ))}
      </select>
      <span className="text-xs text-[#6f6862]">{providers.length} providers</span>
    </div>
  );
}
