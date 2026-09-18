"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "./ui";
import { IconSearch, IconX } from "./icons";

/**
 * Modal shell + picker primitives shared by every selector
 * (repository, branch, harness, model, connections, leaderboard).
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-[520px]",
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Portals keep `position: fixed` anchored to the viewport: ancestors with
  // backdrop-filter/transform (e.g. the blurred workspace header) otherwise
  // become the containing block and push the panel off-screen.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div className="fixed inset-0 animate-fade bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cx(
          "relative z-10 flex max-h-[70vh] w-full animate-slide-up flex-col overflow-hidden rounded-panel border border-border-medium bg-surface-floating shadow-floating outline-none",
          width
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-faint px-4 py-3">
          <div className="min-w-0">
            <h2 id={labelledBy} className="font-display text-sm uppercase tracking-[0.12em] text-text-secondary">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 rounded-xs p-1 text-text-muted transition-colors hover:text-text-tertiary"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && <div className="border-t border-border-faint px-4 py-2.5 text-[11px] text-text-muted">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function DialogSearch({
  value,
  onChange,
  placeholder,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="border-b border-border-faint p-2">
      <div className="flex h-9 items-center gap-2 rounded-sm border border-border-faint bg-surface-tertiary px-2.5 focus-within:border-border-medium">
        <IconSearch className="h-4 w-4 shrink-0 text-text-muted" />
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-full w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
        {value && (
          <button onClick={() => onChange("")} aria-label="Clear search" className="text-text-muted hover:text-text-tertiary">
            <IconX className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function DialogSection({ label }: { label: string }) {
  return (
    <div className="px-3 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">{label}</div>
  );
}

export function DialogRow({
  icon,
  title,
  subtitle,
  right,
  active,
  onClick,
  disabled,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : active ? "bg-surface-raised/80" : "hover:bg-surface-raised/50"
      )}
    >
      {icon && <span className="shrink-0 text-text-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate text-sm", active ? "text-text-primary" : "text-text-secondary")}>{title}</span>
        {subtitle && <span className="mt-0.5 block truncate font-mono text-[11px] text-text-muted">{subtitle}</span>}
      </span>
      {right && <span className="shrink-0">{right}</span>}
    </button>
  );
}

export function DialogEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-xs text-text-muted">{children}</p>;
}

export function DialogSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-6 w-6 animate-shimmer rounded-md bg-surface-skeleton/60" />
          <div className="flex-1 space-y-1.5">
            <div className={cx("h-3 animate-shimmer rounded-sm bg-surface-skeleton/60", i % 2 ? "w-2/5" : "w-3/5")} />
            <div className="h-2.5 w-1/4 animate-shimmer rounded-sm bg-surface-skeleton/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Inline searchable list used inside a Dialog. */
export function useFiltered<T>(items: T[], query: string, keys: (item: T) => string[]) {
  const [filtered, setFiltered] = useState(items);
  useEffect(() => {
    const q = query.trim().toLowerCase();
    setFiltered(!q ? items : items.filter((it) => keys(it).some((k) => (k || "").toLowerCase().includes(q))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query]);
  return filtered;
}
