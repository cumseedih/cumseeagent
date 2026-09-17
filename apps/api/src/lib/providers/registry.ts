import { config } from "../config.js";
import type { Provider, Model, ProviderHealth } from "./types.js";
import { OpenAICompatibleProvider } from "./openaiCompatible.js";
import { MockProvider } from "./mockProvider.js";

class ProviderRegistry {
  private providers = new Map<string, Provider>();

  constructor() {
    // Always register mock for local dev/testing
    const mock = new MockProvider();
    this.providers.set(mock.id, mock);

    // OmniRoute (OpenAI-compatible, primary)
    if (config.providers.omniroute.baseUrl) {
      const p = new OpenAICompatibleProvider("omniroute", "OmniRoute", config.providers.omniroute.baseUrl, config.providers.omniroute.apiKey);
      this.providers.set(p.id, p);
    }

    // OpenAI
    if (config.providers.openai.apiKey) {
      const p = new OpenAICompatibleProvider("openai", "OpenAI", config.providers.openai.baseUrl, config.providers.openai.apiKey);
      this.providers.set(p.id, p);
    }

    // OpenCode (Zen)
    if (config.providers.opencode.baseUrl) {
      const p = new OpenAICompatibleProvider("opencode", "OpenCode", config.providers.opencode.baseUrl, config.providers.opencode.apiKey);
      this.providers.set(p.id, p);
    }

    // Devin — if API key present, treat as OpenAI-compatible, else fallback to omniroute/devin
    if (config.providers.devin.apiKey) {
      const p = new OpenAICompatibleProvider("devin", "Devin", config.providers.devin.baseUrl, config.providers.devin.apiKey);
      this.providers.set(p.id, p);
    } else {
      // Devin via OmniRoute is modeled as omniroute provider with model "devin" — no separate provider needed
      // But we still register a devin alias that proxies to omniroute
      const omni = this.providers.get("omniroute");
      if (omni) {
        const alias: Provider = {
          id: "devin",
          name: "Devin (via OmniRoute)",
          health: () => omni.health(),
          listModels: async () => [{ id: "devin", name: "devin", displayName: "Devin", providerId: "devin", contextLength: 100000, capabilities: ["tool_use"] }],
          chat: (req) => omni.chat({ ...req, model: req.model === "devin" ? "devin" : req.model }),
        };
        this.providers.set(alias.id, alias);
      }
    }
  }

  list(): Provider[] {
    return Array.from(this.providers.values());
  }

  get(id: string): Provider | undefined {
    return this.providers.get(id);
  }

  async listModels(): Promise<Model[]> {
    const all: Model[] = [];
    for (const p of this.providers.values()) {
      try {
        const models = await p.listModels();
        all.push(...models);
      } catch (e) {
        // provider down — skip, but log
        console.warn(`Provider ${p.id} listModels failed:`, (e as Error).message);
      }
    }
    return all;
  }

  async health(id: string): Promise<ProviderHealth> {
    const p = this.providers.get(id);
    if (!p) throw new Error(`Provider ${id} not found`);
    return p.health();
  }

  // Explicit fallback: only if caller passes fallbackProviderId
  async chatWithFallback(request: { providerId: string; model: string; messages: any[]; fallbackProviderId?: string; tools?: any[] }): Promise<AsyncIterable<any>> {
    const primary = this.providers.get(request.providerId);
    if (!primary) throw new Error(`Provider ${request.providerId} not found`);

    try {
      return await primary.chat({ model: request.model, messages: request.messages, stream: true, tools: request.tools });
    } catch (e: any) {
      const msg = e.message || "";
      const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("cooldown");
      if (isQuota && request.fallbackProviderId) {
        const fallback = this.providers.get(request.fallbackProviderId);
        if (!fallback) throw e;
        console.warn(`Primary ${request.providerId} failed (${msg}), falling back to ${request.fallbackProviderId}`);
        return await fallback.chat({ model: request.model, messages: request.messages, stream: true, tools: request.tools });
      }
      throw e;
    }
  }
}

export const providerRegistry = new ProviderRegistry();
