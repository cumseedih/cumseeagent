"use client";

import React from "react";

/** Class helper. */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-interactive-cta text-interactive-on-cta hover:bg-interactive-cta-hover border border-transparent",
  secondary:
    "bg-transparent text-text-secondary border border-border-faint hover:bg-surface-raised hover:text-interactive-active",
  ghost:
    "bg-transparent text-text-tertiary border border-transparent hover:bg-surface-raised/70 hover:text-interactive-active",
  danger:
    "bg-transparent text-interactive-negative border border-interactive-negative/40 hover:bg-interactive-negative/10",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  icon: "h-8 w-8",
};

export function Button({
  variant = "secondary",
  size = "sm",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-sm font-normal",
        "transition-colors duration-150 ease-out active:translate-y-[0.5px]",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  interactive,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      {...rest}
      className={cx(
        "rounded-panel border border-border-faint bg-surface-secondary/70 backdrop-blur-[2px]",
        interactive && "transition-colors hover:border-border-medium hover:bg-surface-secondary",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  label,
  right,
  className,
}: {
  label: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex h-9 items-center justify-between gap-2 px-3", className)}>
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">{label}</span>
      {right}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Chips, pills, badges                                                        */
/* -------------------------------------------------------------------------- */

export function Chip({
  active,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex h-8 max-w-full items-center gap-1.5 rounded-sm border px-2.5 text-xs",
        "transition-colors duration-150",
        active
          ? "border-border-medium bg-surface-raised text-interactive-active"
          : "border-border-faint text-text-tertiary hover:border-border-medium hover:bg-surface-raised/60 hover:text-interactive-active",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { dot: string; label: string; tone: string }> = {
    idle: { dot: "bg-text-muted", label: "Idle", tone: "text-text-muted border-border-faint" },
    running: {
      dot: "bg-interactive-warning animate-pulse",
      label: "Running",
      tone: "text-interactive-warning border-interactive-warning/40",
    },
    thinking: {
      dot: "bg-interactive-link animate-pulse",
      label: "Thinking",
      tone: "text-interactive-link border-interactive-link/40",
    },
    completed: {
      dot: "bg-interactive-positive",
      label: "Completed",
      tone: "text-interactive-positive border-interactive-positive/40",
    },
    failed: {
      dot: "bg-interactive-negative",
      label: "Failed",
      tone: "text-interactive-negative border-interactive-negative/40",
    },
    waiting: {
      dot: "bg-interactive-warning",
      label: "Needs approval",
      tone: "text-interactive-warning border-interactive-warning/40",
    },
  };
  const s = map[status] || map.idle;
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 rounded-full border bg-surface-tertiary/60 px-2 text-[11px]",
        s.tone
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading skeletons                                                           */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-shimmer rounded-sm bg-surface-skeleton/60", className)} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5 rounded-md px-1 py-1.5">
          <Skeleton className={cx("h-3", i % 3 === 0 ? "w-4/5" : i % 3 === 1 ? "w-3/5" : "w-2/3")} />
          <Skeleton className="h-2.5 w-1/3 opacity-60" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

export function ErrorNote({ children, onRetry }: { children: React.ReactNode; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-interactive-negative/30 bg-interactive-negative/[0.07] px-3 py-2 text-xs text-interactive-negative">
      <span className="mt-[1px]">{children}</span>
      {onRetry && (
        <button onClick={onRetry} className="ml-auto shrink-0 underline underline-offset-2 hover:opacity-80">
          Retry
        </button>
      )}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx("h-px w-full bg-border-faint", className)} />;
}

export function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border-faint bg-surface-tertiary px-1 font-mono text-[10px] text-text-tertiary">
      {children}
    </kbd>
  );
}
