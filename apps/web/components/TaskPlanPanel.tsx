"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { cx } from "./ui";
import { IconCheck, IconClock, IconSparkle } from "./icons";

type PlanStep = { id?: string; title?: string; status?: string };

function normalizePlan(value: any) {
  if (!value) return null;
  let plan = value;
  if (typeof value.planJson === "string") {
    try { plan = JSON.parse(value.planJson); } catch { return null; }
  } else if (value.planJson && typeof value.planJson === "object") plan = value.planJson;
  return plan && Array.isArray(plan.steps) ? plan : null;
}

export function TaskPlanPanel({ runId, events, status, groupChatMode = false }: { runId?: string | null; events: Array<{ id: string; eventType: string; payload?: any }>; status: string; groupChatMode?: boolean }) {
  const [storedPlan, setStoredPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!runId || groupChatMode) { setStoredPlan(null); setLoading(false); return; }
    setLoading(true);
    api.getPlan(runId).then((result: any) => { if (alive) setStoredPlan(result.plan); }).catch(() => { if (alive) setStoredPlan(null); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [runId, groupChatMode]);

  const eventPlan = useMemo(() => {
    const latest = [...events].reverse().find((event) => ["agent.plan.created", "agent.plan.updated"].includes(event.eventType) && (!runId || event.payload?.agentRunId === runId));
    return normalizePlan(latest?.payload?.plan);
  }, [events, runId]);
  const plan = eventPlan || normalizePlan(storedPlan);
  const steps: PlanStep[] = plan?.steps || [];
  const completed = steps.filter((step) => step.status === "completed").length;
  const latestPlanEvent = [...events].reverse().find((event) => ["agent.plan.generating", "agent.plan.unavailable"].includes(event.eventType) && (!runId || event.payload?.agentRunId === runId));

  if (groupChatMode) return <div className="p-4 text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-raised text-text-muted"><IconSparkle className="h-5 w-5" /></span><p className="mt-3 text-sm font-medium text-text-secondary">Group Chat</p><p className="mt-1 text-xs leading-5 text-text-muted">Agents reply one by one in the shared conversation. Group Chats are conversational and do not generate execution plans.</p></div>;

  if (!plan) return <div className="p-4 text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-raised text-text-muted"><IconSparkle className="h-5 w-5" /></span><p className="mt-3 text-sm font-medium text-text-secondary">{latestPlanEvent?.eventType === "agent.plan.generating" ? "Creating a task plan…" : latestPlanEvent?.eventType === "agent.plan.unavailable" ? "Plan unavailable" : "No task plan yet"}</p><p className="mt-1 text-xs leading-5 text-text-muted">{latestPlanEvent?.eventType === "agent.plan.unavailable" ? "The agent continued without displaying a plan because the model did not return readable steps." : "A task plan appears here when the model returns ordered, readable steps."}</p>{loading && <p className="mt-2 text-[10px] text-text-muted">Loading plan…</p>}</div>;

  return <div className="p-3">
    <div className="rounded-xl border border-border-faint bg-surface-secondary p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Goal</p><p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-text-secondary">{plan.goal || "Agent task"}</p></div>
    <div className="mt-4 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Plan</p><span className="text-[10px] tabular-nums text-text-muted">{completed}/{steps.length} complete</span></div>
    <ol className="relative mt-3 space-y-1 before:absolute before:bottom-4 before:left-[13px] before:top-4 before:w-px before:bg-border-faint">
      {steps.map((step, index) => {
        const isDone = step.status === "completed";
        const isCurrent = !isDone && (step.status === "in_progress" || (!(status === "completed") && (status === "running" || status === "thinking") && index === Math.min(completed, steps.length - 1)));
        return <li key={step.id || `${index}-${step.title}`} className="relative flex items-start gap-3 rounded-lg px-1 py-2">
          <span className={cx("z-[1] grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border", isDone ? "border-interactive-positive/30 bg-interactive-positive/10 text-interactive-positive" : isCurrent ? "border-interactive-link/30 bg-interactive-link/10 text-interactive-link" : "border-border-faint bg-surface-primary text-text-muted")}>
            {isDone ? <IconCheck className="h-3.5 w-3.5" /> : isCurrent ? <span className="h-2 w-2 animate-pulse rounded-full bg-current" /> : <IconClock className="h-3 w-3" />}
          </span>
          <div className="min-w-0 flex-1 pt-1"><p className={cx("text-xs leading-4", isDone ? "text-text-secondary" : isCurrent ? "font-medium text-text-primary" : "text-text-muted")}>{step.title || `Step ${index + 1}`}</p>{isCurrent && <p className="mt-1 text-[10px] text-interactive-link">In progress</p>}</div>
        </li>;
      })}
    </ol>
    {status === "failed" && <p className="mt-3 rounded-lg bg-interactive-negative/[0.07] px-3 py-2 text-[11px] text-interactive-negative">This run stopped before the plan finished.</p>}
  </div>;
}
