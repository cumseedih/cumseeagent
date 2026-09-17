"use client";

export function MessageList({ messages }: { messages: any[] }) {
  if (!messages.length) {
    return <div className="py-10 text-center text-sm text-[#9aa0b2]">No messages yet. Send a prompt above to start.</div>;
  }
  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <div key={m.id} className={`rounded-lg border p-3 text-sm ${m.role === "user" ? "border-[#1e2433] bg-[#11151f]" : "border-[#1a2032] bg-[#0f131d]"}`}>
          <div className="mb-1 text-xs font-semibold tracking-wide text-[#9aa0b2]">{m.role.toUpperCase()} • {new Date(m.createdAt).toLocaleTimeString()} • {m.status}</div>
          <div className="whitespace-pre-wrap break-words">{m.content}</div>
        </div>
      ))}
    </div>
  );
}
