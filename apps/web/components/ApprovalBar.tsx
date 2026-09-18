"use client";

import { useState } from "react";
import { api } from "../lib/api";
import { Button, cx } from "./ui";
import { IconAlert, IconShield } from "./icons";

const RISK_TONE: Record<string, string> = {
  low: "border-border-medium text-text-tertiary",
  medium: "border-interactive-warning/40 text-interactive-warning",
  high: "border-interactive-negative/50 text-interactive-negative",
  critical: "border-interactive-negative text-interactive-negative",
};

/** Approval gate for risky tool calls. Nothing executes until this resolves. */
export function ApprovalBar({ toolCall, onResolved }: { toolCall: any; onResolved: () => void }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!toolCall || toolCall.approvalStatus !== "pending") return null;

  const args = toolCall.argumentsJson ?? toolCall.arguments_json ?? {};
  const risk = String(toolCall.riskLevel || "medium").toLowerCase();
  const preview =
    typeof args === "string"
      ? args
      : args.command || args.path || args.pattern || JSON.stringify(args, null, 2);

  async function resolve(kind: "approve" | "reject") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "approve") await api.approveTool(toolCall.id);
      else await api.rejectTool(toolCall.id, "Rejected by operator");
      onResolved();
    } catch (e: any) {
      setError(e.message || "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="animate-slide-up overflow-hidden rounded-panel border border-interactive-warning/40 bg-interactive-warning/[0.06]">
      <div className="flex items-center gap-2 border-b border-interactive-warning/25 px-3 py-2">
        <span className="text-interactive-warning">
          <IconAlert className="h-4 w-4" />
        </span>
        <span className="text-sm text-text-primary">Approval required</span>
        <span className="font-mono text-xs text-text-tertiary">{toolCall.toolName}</span>
        <span className={cx("ml-auto rounded-full border px-2 py-0.5 text-[10px] uppercase", RISK_TONE[risk] || RISK_TONE.medium)}>
          {risk} risk
        </span>
      </div>

      <div className="px-3 py-2.5">
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-sm border border-border-faint bg-surface-floating p-2 font-mono text-[11.5px] leading-relaxed text-text-secondary">
          {typeof preview === "string" ? preview.slice(0, 3000) : JSON.stringify(preview, null, 2).slice(0, 3000)}
        </pre>
        {toolCall.reason && <p className="mt-2 text-xs text-text-muted">{toolCall.reason}</p>}

        {error && <p className="mt-2 text-xs text-interactive-negative">{error}</p>}

        <div className="mt-3 flex items-center gap-2">
          <Button variant="primary" size="sm" disabled={busy !== null} onClick={() => resolve("approve")}>
            <IconShield className="h-3.5 w-3.5" />
            {busy === "approve" ? "Approving…" : "Approve once"}
          </Button>
          <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => resolve("approve")}>
            Allow for session
          </Button>
          <Button variant="danger" size="sm" disabled={busy !== null} onClick={() => resolve("reject")} className="ml-auto">
            {busy === "reject" ? "Rejecting…" : "Deny"}
          </Button>
        </div>
      </div>
    </div>
  );
}
