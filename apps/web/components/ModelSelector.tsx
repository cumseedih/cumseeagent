"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { Chip, cx } from "./ui";
import { IconCheck, IconChevronDown, IconCpu, IconShield } from "./icons";

type Model = { id: string; name?: string; displayName?: string; providerId: string; contextLength?: number };
type Provider = { id: string; name?: string; configured?: boolean; healthy?: boolean };

/**
 * Compact model picker: chip opens a popover listing providers → models,
 * plus an "Auto (sampled)" default that lets the backend route per request.
 */
export function ModelSelector({
  value,
  providerId,
  harness,
  onHarnessChange,
  onChange,
}: {
  value: string;
  providerId?: string;
  harness?: string;
  onHarnessChange?: (h: string) => void;
  onChange: (modelId: string, providerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Model[]>();
    for (const m of models) {
      if (!map.has(m.providerId)) map.set(m.providerId, []);
      map.get(m.providerId)!.push(m);
    }
    return Array.from(map.entries());
  }, [models]);

  const current = models.find((m) => m.id === value);
  const label = loading ? "Loading models…" : current ? current.displayName || current.name || current.id : value || "Auto (sampled)";

  return (
    <div className="flex items-center gap-1.5" ref={ref}>
      {onHarnessChange && (
        <div className="relative">
          <Chip
            onClick={() => onHarnessChange(harness === "standard" ? "fast" : "standard")}
            title="Agent harness profile"
            className="hidden sm:inline-flex"
          >
            <IconShield className="h-3.5 w-3.5" />
            {harness === "fast" ? "Fast harness" : "Standard harness"}
          </Chip>
        </div>
      )}

      <div className="relative">
          <Chip
            onClick={() => setOpen((v) => !v)}
            title="Select model"
            className="max-w-[150px] sm:max-w-[260px]"
          >
          <IconCpu className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{label}</span>
          <IconChevronDown className={cx("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
        </Chip>

        {open && (
          <div className="absolute right-0 z-40 mt-1.5 w-72 animate-slide-up overflow-hidden rounded-panel border border-border-medium bg-surface-floating shadow-floating">
            <div className="border-b border-border-faint px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">Model</p>
            </div>

            {error && <div className="px-3 py-2 text-xs text-interactive-negative">{error}</div>}

            <div className="max-h-72 overflow-y-auto py-1">
              <PopoverItem
                active={!value}
                title="Auto (sampled)"
                subtitle="Backend routes to the healthiest provider"
                onClick={() => {
                  onChange("", "");
                  setOpen(false);
                }}
              />
              {grouped.map(([pid, list]) => (
                <div key={pid} className="mt-1">
                  <div className="px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-text-muted">
                    {providers.find((p) => p.id === pid)?.name || pid}
                    {providers.find((p) => p.id === pid)?.healthy === false && (
                      <span className="ml-1 text-interactive-negative">· offline</span>
                    )}
                  </div>
                  {list.map((m) => (
                    <PopoverItem
                      key={m.id}
                      active={value === m.id}
                      title={m.displayName || m.name || m.id}
                      subtitle={m.id}
                      onClick={() => {
                        onChange(m.id, m.providerId);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              ))}
              {!loading && grouped.length === 0 && !error && (
                <p className="px-3 py-2 text-xs text-text-muted">
                  No models configured. Add an API key to a provider to list models here.
                </p>
              )}
            </div>

            <div className="border-t border-border-faint px-3 py-2 text-[10px] text-text-muted">
              Provider keys stay server-side · never exposed to the browser
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PopoverItem({
  title,
  subtitle,
  active,
  onClick,
}: {
  title: string;
  subtitle?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
        active ? "bg-surface-raised/80" : "hover:bg-surface-raised/50"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-text-secondary">{title}</span>
        {subtitle && <span className="block truncate font-mono text-[10px] text-text-muted">{subtitle}</span>}
      </span>
      {active && <IconCheck className="h-3.5 w-3.5 shrink-0 text-interactive-positive" />}
    </button>
  );
}
