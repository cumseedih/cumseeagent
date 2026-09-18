"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Chip, cx } from "./ui";
import { Dialog, DialogEmpty, DialogRow, DialogSearch, DialogSection, DialogSkeleton } from "./Dialog";
import { IconCheck, IconChevronDown, IconCpu } from "./icons";

type Model = {
  id: string;
  name?: string;
  displayName?: string;
  providerId: string;
  contextLength?: number;
  available?: boolean;
};
type Provider = { id: string; name?: string; configured?: boolean; healthy?: boolean };

/**
 * Model picker.
 * "Auto (sampled)" leaves routing to the backend; otherwise the list is grouped
 * by provider with search, and unavailable models are shown but disabled.
 */
export function ModelSelector({
  value,
  providerId,
  onChange,
}: {
  value: string;
  providerId?: string;
  onChange: (modelId: string, providerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [m, p] = await Promise.all([api.listModels(), api.listProviders()]);
        setModels(m.models || []);
        setProviders(p.providers || []);
      } catch (e: any) {
        setError(e.message || "Models unavailable");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = q
      ? models.filter((m) => (m.displayName || m.name || m.id).toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      : models;
    const map = new Map<string, Model[]>();
    for (const m of visible) {
      if (!map.has(m.providerId)) map.set(m.providerId, []);
      map.get(m.providerId)!.push(m);
    }
    return Array.from(map.entries());
  }, [models, query]);

  const current = models.find((m) => m.id === value);
  const label = loading ? "Loading models…" : current ? current.displayName || current.name || current.id : "Auto (sampled)";

  return (
    <>
      <Chip onClick={() => setOpen(true)} data-testid="model-chip" title="Select model" className="max-w-[150px] sm:max-w-[240px]">
        <IconCpu className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        <IconChevronDown className="h-3.5 w-3.5 shrink-0" />
      </Chip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Model"
        subtitle="Auto lets the backend route to the healthiest provider."
        labelledBy="model-picker-title"
        width="max-w-[480px]"
      >
        <DialogSearch value={query} onChange={setQuery} placeholder="Search models…" />

        {loading && <DialogSkeleton rows={4} />}

        {!loading && error && <DialogEmpty>Models unavailable — {error}</DialogEmpty>}

        {!loading && !error && (
          <>
            <DialogRow
              icon={<IconCpu className="h-4 w-4" />}
              title="Auto (sampled)"
              subtitle="Backend picks a healthy provider per request"
              active={!value}
              right={!value ? <IconCheck className="h-4 w-4 text-interactive-positive" /> : undefined}
              onClick={() => {
                onChange("", "");
                setOpen(false);
              }}
            />

            {grouped.map(([pid, list]) => (
              <div key={pid}>
                <DialogSection
                  label={(providers.find((p) => p.id === pid)?.name || pid).toUpperCase()}
                />
                {list.map((m) => {
                  const unavailable = m.available === false || providers.find((p) => p.id === pid)?.healthy === false;
                  return (
                    <DialogRow
                      key={m.id}
                      title={`${m.displayName || m.name || m.id}${unavailable ? " (unavailable)" : ""}`}
                      subtitle={m.id}
                      active={value === m.id}
                      disabled={unavailable}
                      right={value === m.id ? <IconCheck className="h-4 w-4 text-interactive-positive" /> : undefined}
                      onClick={() => {
                        onChange(m.id, m.providerId);
                        setOpen(false);
                      }}
                    />
                  );
                })}
              </div>
            ))}

            {grouped.length === 0 && <DialogEmpty>No models found.</DialogEmpty>}
          </>
        )}
      </Dialog>
    </>
  );
}
