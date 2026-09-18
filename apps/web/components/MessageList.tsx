"use client";

export function MessageList({ messages }: { messages: any[] }) {
  if (!messages.length) {
    return <div className="py-10 text-center text-sm text-[#6f6862]">No messages yet. Send a prompt above to start.</div>;
  }
  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <div key={m.id} className={`rounded-lg border p-3 text-sm ${m.role === "user" ? "border-[#e5e7eb] bg-[#11151f]" : "border-[#1a2032] bg-white"}`}>
          <div className="mb-1 text-xs font-semibold tracking-wide text-[#6f6862]">{m.role.toUpperCase()} • {new Date(m.createdAt).toLocaleTimeString()} • {m.status}</div>
          <div className="whitespace-pre-wrap break-words">{m.content}</div>
        </div>
      ))}
    </div>
  );
}
