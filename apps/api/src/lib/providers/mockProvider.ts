import { BaseProvider } from "./base.js";
import type { Model, ProviderHealth, ChatRequest, ChatChunk } from "./types.js";

export class MockProvider extends BaseProvider {
  id = "mock";
  name = "Mock Provider (local)";

  async health(): Promise<ProviderHealth> {
    return { status: "ok", latencyMs: 5 };
  }

  async listModels(): Promise<Model[]> {
    return [
      { id: "mock-gpt-4o", name: "mock-gpt-4o", displayName: "Mock GPT-4o", providerId: "mock", contextLength: 128000, capabilities: ["tool_use", "thinking"] },
      { id: "mock-claude-sonnet", name: "mock-claude-sonnet", displayName: "Mock Claude Sonnet", providerId: "mock", contextLength: 200000, capabilities: ["tool_use", "image_in"] },
    ];
  }

  async chat(request: ChatRequest): Promise<AsyncIterable<ChatChunk>> {
    const responseText = `Mock response for model ${request.model}: You said "${request.messages[request.messages.length - 1]?.content?.slice(0, 100)}". This is a simulated streaming response from the mock provider. In production, connect OmniRoute, Devin, OpenCode or OpenAI.`;

    async function* gen(): AsyncIterable<ChatChunk> {
      // Stream word by word
      const words = responseText.split(" ");
      for (let i = 0; i < words.length; i++) {
        await new Promise((r) => setTimeout(r, 30));
        yield {
          id: `mock-${Date.now()}`,
          choices: [{ delta: { content: words[i] + " " }, finish_reason: i === words.length - 1 ? "stop" : null }],
        };
      }
    }
    return gen();
  }
}
