import type { Metadata } from "next";
import Link from "next/link";
import { BRANDING } from "../../branding.config";

export const metadata: Metadata = { title: `Terms of Use — ${BRANDING.PRODUCT_NAME}` };

const SECTIONS: [string, string][] = [
  [
    "1. Acceptance",
    `By accessing or using ${BRANDING.PRODUCT_NAME} you agree to be bound by these Terms of Use. If you do not agree, do not use the service.`,
  ],
  [
    "2. Your workspace",
    `Sessions execute inside workspaces you control. You are responsible for the repositories, credentials and infrastructure connected to ${BRANDING.PRODUCT_NAME}.`,
  ],
  [
    "3. Agent actions and approvals",
    "Agent runs may propose commands, file writes and git operations. Commands classified as elevated risk are held until you explicitly approve them. You remain responsible for reviewing and approving each action.",
  ],
  [
    "4. Acceptable use",
    "Do not use the service to violate law, infringe rights, or attack systems you do not own or have permission to test. Automated runs remain your responsibility.",
  ],
  [
    "5. Third-party providers",
    "Model output is produced by third-party providers you configure. Their terms and availability apply. Provider keys are stored server-side and never exposed to the browser.",
  ],
  [
    "6. No warranty",
    `The service is provided "as is" without warranties of any kind. Agent output may be incorrect; verify changes before relying on them.`,
  ],
  [
    "7. Changes",
    `We may update these terms. Material changes bump the terms version and require re-acceptance before the workspace becomes available again.`,
  ],
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Link href="/" className="text-xs text-text-muted underline underline-offset-2 hover:text-text-tertiary">
        ← Back to workspace
      </Link>
      <h1 className="font-serif-display mt-6 text-3xl text-text-primary">Terms of Use</h1>
      <p className="mt-2 text-xs text-text-muted">
        {BRANDING.PRODUCT_NAME} · version {process.env.TOU_VERSION || "1"}
      </p>
      <div className="mt-8 space-y-6">
        {SECTIONS.map(([heading, body]) => (
          <section key={heading}>
            <h2 className="font-display text-sm uppercase tracking-[0.12em] text-text-secondary">{heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-tertiary">{body}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 text-xs text-text-muted">
        Questions: <span className="font-mono">{BRANDING.SUPPORT_EMAIL}</span>
      </p>
    </main>
  );
}
