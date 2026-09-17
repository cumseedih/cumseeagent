"use client";

export function ToolTimeline({ events }: { events: any[] }) {
  const toolEvents = events.filter((e) => e.eventType.startsWith("tool.") || e.eventType.startsWith("agent.") || e.eventType.startsWith("file."));
  if (!toolEvents.length) return <div className="text-xs text-[#6b7280]">No tool activity yet.</div>;

  return (
    <div className="space-y-2">
      {toolEvents.slice(-50).map((e) => (
        <div key={e.id} className="rounded border border-[#1e2433] bg-[#0f131d] p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#1a2032] px-1.5 py-0.5 font-mono">{e.eventType}</span>
            <span className="text-[#9aa0b2]">{new Date(e.createdAt).toLocaleTimeString()}</span>
          </div>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[11px] text-[#cbd5e1]">{JSON.stringify(e.payload, null, 2).slice(0, 2000)}</pre>
        </div>
      ))}
    </div>
  );
}
