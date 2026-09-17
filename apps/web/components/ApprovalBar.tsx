"use client";
import { api } from "../lib/api";

export function ApprovalBar({ toolCall, onResolved }: { toolCall: any; onResolved: () => void }) {
  if (!toolCall || toolCall.approvalStatus !== "pending") return null;
  return (
    <div className="rounded border border-[#f59e0b] bg-[#1a1400] p-3 text-sm">
      <div className="font-semibold text-[#fbbf24]">Approval required — {toolCall.toolName} ({toolCall.riskLevel})</div>
      <div className="mt-1 font-mono text-xs">{JSON.stringify(toolCall.argumentsJson || toolCall.arguments_json, null, 2)}</div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={async () => {
            await api.approveTool(toolCall.id);
            onResolved();
          }}
          className="rounded bg-[#f59e0b] px-3 py-1 text-black"
        >
          Approve
        </button>
        <button
          onClick={async () => {
            const reason = prompt("Reason for rejection?") || "Rejected by user";
            await api.rejectTool(toolCall.id, reason);
            onResolved();
          }}
          className="rounded border border-[#f59e0b] px-3 py-1 text-[#fbbf24]"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
