"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileViewer } from "./FileViewer";
import { IconFolder, IconX } from "./icons";

export function WorkspaceSheet({
  open,
  onClose,
  project,
  refreshKey,
}: {
  open: boolean;
  onClose: () => void;
  project?: { id: string; name: string } | null;
  refreshKey?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => sheetRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close workspace"
        onClick={onClose}
        className="absolute inset-0 h-full w-full animate-fade bg-black/55 backdrop-blur-[1px]"
      />
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-sheet-title"
        tabIndex={-1}
        className="animate-sheet-up absolute inset-x-0 bottom-0 flex h-[72dvh] max-h-[760px] flex-col overflow-hidden rounded-t-[24px] border border-b-0 border-border-faint bg-surface-floating shadow-[0_-24px_70px_rgba(29,29,31,0.16)] outline-none sm:inset-x-5 sm:mx-auto sm:max-w-3xl"
      >
        <div className="flex h-7 shrink-0 items-center justify-center">
          <span className="h-1 w-10 rounded-full bg-border-medium" />
        </div>
        <div className="flex shrink-0 items-center gap-3 border-b border-border-faint px-4 pb-3 pt-1">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-tertiary text-interactive-link">
            <IconFolder className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="workspace-sheet-title" className="text-base font-semibold text-text-primary">Workspace</h2>
            <p className="truncate text-[11px] text-text-muted">
              {project ? `${project.name} · agent files and folders` : "No workspace selected"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close workspace"
            className="grid h-9 w-9 place-items-center rounded-xl bg-surface-tertiary text-text-muted transition-colors hover:text-text-primary"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {project ? (
          <FileViewer projectId={project.id} refreshKey={refreshKey} />
        ) : (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <IconFolder className="mx-auto h-8 w-8 text-text-muted" />
              <p className="mt-3 text-sm text-text-secondary">Connect a repository to view its workspace.</p>
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body
  );
}
