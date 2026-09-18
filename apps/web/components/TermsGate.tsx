"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { BRANDING } from "../branding.config";
import { Button, KeyCap } from "./ui";
import { Mark } from "./Wordmark";

/**
 * Terms of Use gate shown once before the workspace is usable.
 * Consent is recorded server-side (audit log) and mirrored in localStorage so
 * the gate does not flash on every load.
 */
export function TermsGate({ onAccepted }: { onAccepted: () => void }) {
  const [checked, setChecked] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let alive = true;
    const cached = typeof window !== "undefined" ? localStorage.getItem("tou_version") : null;
    (async () => {
      try {
        const state = await api.getTerms();
        if (!alive) return;
        if (state.accepted) {
          localStorage.setItem("tou_version", state.version);
          setAccepted(true);
          onAccepted();
        } else if (cached && cached === state.version) {
          // server unreachable but previously accepted this version
          setAccepted(true);
          onAccepted();
        }
      } catch {
        if (alive && cached) {
          setAccepted(true);
          onAccepted();
        }
      } finally {
        if (alive) setChecked(true);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function agree() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.acceptTerms();
      localStorage.setItem("tou_version", res.version);
      setAccepted(true);
      onAccepted();
    } catch (e: any) {
      setError(e.message || "Failed to accept terms-of-use");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!checked || accepted) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        void agree();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!checked || accepted || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-[2px]" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tou-title"
        className="relative z-10 w-full max-w-md animate-slide-up rounded-panel border border-border-medium bg-surface-floating p-5 shadow-floating"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <Mark className="h-7 w-7" />
          <span className="font-display text-xs uppercase tracking-[0.18em] text-text-secondary">
            {BRANDING.PRODUCT_NAME}
          </span>
        </div>

        <h2 id="tou-title" className="font-serif-display text-xl text-text-primary">
          Terms of Use &amp; Privacy Policy
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-text-tertiary">
          By continuing, you agree to be bound by our{" "}
          <a href="/terms-of-use" target="_blank" rel="noopener noreferrer" className="text-interactive-link underline underline-offset-2">
            Terms of Use
          </a>{" "}
          and{" "}
          <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-interactive-link underline underline-offset-2">
            Privacy Policy
          </a>
          . Sessions run on infrastructure you control, and every risky command still requires your approval
          before it executes.
        </p>

        {error && (
          <p className="mt-3 rounded-md border border-interactive-negative/30 bg-interactive-negative/[0.07] px-3 py-2 text-xs text-interactive-negative">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <Button variant="primary" size="md" onClick={agree} disabled={busy} className="flex-1">
            {busy ? "Accepting…" : "Agree and continue"}
          </Button>
        </div>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
          Or hit <KeyCap>⏎</KeyCap> on your keyboard to agree
        </p>
      </div>
    </div>,
    document.body
  );
}
