import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider } from "../lib/providers/openaiCompatible.js";

afterEach(() => vi.unstubAllGlobals());

describe("OpenAICompatibleProvider streaming", () => {
  it("preserves tool-call-only deltas", async () => {
    const payload = [
      `data: ${JSON.stringify({ id: "one", choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "write_file", arguments: '{"path":"index.html"}' } }] }, finish_reason: null }] })}`,
      "data: [DONE]",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(payload, { status: 200 })));

    const provider = new OpenAICompatibleProvider("test", "Test", "https://provider.invalid/v1", "key");
    const stream = await provider.chat({ model: "test-model", messages: [{ role: "user", content: "build it" }], tools: [] });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].choices[0].delta.tool_calls?.[0].function.name).toBe("write_file");
  });

  it("reads final text from message content when delta is empty", async () => {
    const payload = [
      `data: ${JSON.stringify({ id: "two", choices: [{ delta: {}, message: { content: "Finished with real output." }, finish_reason: "stop" }] })}`,
      "data: [DONE]",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(payload, { status: 200 })));

    const provider = new OpenAICompatibleProvider("test", "Test", "https://provider.invalid/v1", "key");
    const stream = await provider.chat({ model: "test-model", messages: [{ role: "user", content: "status" }] });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);

    expect(chunks[0].choices[0].delta.content).toBe("Finished with real output.");
  });
});
