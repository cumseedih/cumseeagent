import type { Metadata } from "next";
import Link from "next/link";
import { BRANDING } from "../../branding.config";

export const metadata: Metadata = { title: `Privacy Policy — ${BRANDING.PRODUCT_NAME}` };

const SECTIONS: [string, string][] = [
  [
    "What we store",
    "Account records (email, hashed password), projects, sessions, messages, agent runs, tool calls, terminal commands and file changes needed to operate the workspace.",
  ],
  [
    "Audit log",
    "Approvals, consent records and security-relevant actions are written to an audit log with timestamps and IP address for accountability.",
  ],
  [
    "Provider keys",
    "Model provider credentials live in server-side environment configuration. They are never sent to the browser and never written into the database.",
  ],
  [
    "Your code",
    "Repository contents stay inside the workspaces you configure on infrastructure you operate. We do not train on your code.",
  ],
  [
    "Retention",
    "Session history is retained until you delete it. Deleting a session removes its messages, runs, tool calls and events.",
  ],
  [
    "Third parties",
    "Requests sent to a configured model provider are governed by that provider's privacy policy. Nothing is sent to a provider unless a run is started.",
  ],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Link href="/" className="text-xs text-text-muted underline underline-offset-2 hover:text-text-tertiary">
        ← Back to workspace
      </Link>
      <h1 className="font-serif-display mt-6 text-3xl text-text-primary">Privacy Policy</h1>
      <p className="mt-2 text-xs text-text-muted">{BRANDING.PRODUCT_NAME}</p>
      <div className="mt-8 space-y-6">
        {SECTIONS.map(([heading, body]) => (
          <section key={heading}>
            <h2 className="font-display text-sm uppercase tracking-[0.12em] text-text-secondary">{heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-tertiary">{body}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 text-xs text-text-muted">
        Contact: <span className="font-mono">{BRANDING.SUPPORT_EMAIL}</span>
      </p>
    </main>
  );
}
