import { describe, it, expect } from "vitest";
import { providerRegistry } from "../lib/providers/registry.js";

describe("Providers", () => {
  it("lists providers", async () => {
    const providers = providerRegistry.list();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some((p) => p.id === "mock")).toBe(true);
  });

  it("lists models (mock + opencode)", async () => {
    const models = await providerRegistry.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.providerId === "mock")).toBe(true);
  });

  it("checks health of mock", async () => {
    const health = await providerRegistry.health("mock");
    expect(health.status).toBe("ok");
  });

  it("handles 429/quota via mock (no throw for mock)", async () => {
    const provider = providerRegistry.get("mock")!;
    const stream = await provider.chat({ model: "mock-gpt-4o", messages: [{ role: "user", content: "hello" }], stream: true });
    let content = "";
    for await (const chunk of stream) {
      content += chunk.choices[0]?.delta?.content || "";
    }
    expect(content.length).toBeGreaterThan(0);
  });

  it("throws for unknown provider", async () => {
    await expect(providerRegistry.health("unknown-xyz")).rejects.toThrow();
  });
});
