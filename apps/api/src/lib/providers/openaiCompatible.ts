import { BaseProvider } from "./base.js";
import type { Model, ProviderHealth, ChatRequest, ChatChunk } from "./types.js";

export class OpenAICompatibleProvider extends BaseProvider {
  id: string;
  name: string;
  private baseUrl: string;
  private apiKey: string;

  constructor(id: string, name: string, baseUrl: string, apiKey: string) {
    super();
    this.id = id;
    this.name = name;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      if (this.isInCooldown()) {
        return { status: "down", latencyMs: 0, error: "In cooldown" };
      }
      // Try models endpoint
      const res = await this.withTimeout(
        fetch(`${this.baseUrl}/models`, {
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        }),
        10000
      );
      const latency = Date.now() - start;
      if (!res.ok) {
        return { status: "degraded", latencyMs: latency, error: `HTTP ${res.status}` };
      }
      return { status: "ok", latencyMs: latency };
    } catch (e: any) {
      return { status: "down", latencyMs: Date.now() - start, error: e.message };
    }
  }

  async listModels(): Promise<Model[]> {
    return this.withRetry(async () => {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as any;
      // OpenAI format: { data: [{id, ...}] } or { models: [...] }
      const list = data.data || data.models || [];
      return list.map((m: any) => ({
        id: m.id,
        name: m.id,
        displayName: m.display_name || m.name || m.id,
        providerId: this.id,
        contextLength: m.context_length || 128000,
        capabilities: m.capabilities || [],
      }));
    });
  }

  async chat(request: ChatRequest): Promise<AsyncIterable<ChatChunk>> {
    if (this.isInCooldown()) {
      throw new Error(`Provider ${this.id} is in cooldown`);
    }

    const response = await this.withRetry(async () => {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: true,
          tools: request.tools,
          temperature: request.temperature ?? 0.7,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        // Handle 429/quota
        if (res.status === 429 || text.includes("quota")) {
          this.recordFailure(new Error(`429 quota: ${text}`));
          throw new Error(`Provider quota exceeded (429): ${text}`);
        }
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return res;
    });

    // Stream handling — assume SSE
    const self = this;
    async function* generator(): AsyncIterable<ChatChunk> {
      const reader = (response as any).body?.getReader();
      if (!reader) {
        // Fallback: non-streaming?
        const text = await (response as any).text();
        yield { id: "mock", choices: [{ delta: { content: text }, finish_reason: "stop" }] };
        return;
      }
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            // Normalize to ChatChunk
            const chunk: ChatChunk = {
              id: json.id || "stream",
              choices: json.choices?.map((c: any) => ({
                delta: c.delta || { content: c.text || c.content },
                finish_reason: c.finish_reason,
              })) || [{ delta: { content: data } }],
            };
            yield chunk;
          } catch {
            // raw text
            yield { id: "stream", choices: [{ delta: { content: data } }] };
          }
        }
      }
      self.recordSuccess();
    }

    return generator();
  }
}
