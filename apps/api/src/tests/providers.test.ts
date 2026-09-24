import { describe, it, expect } from "vitest";
import { providerRegistry } from "../lib/providers/registry.js";

describe("Providers", () => {
  it("lists configured production providers without a simulated provider", async () => {
    const providers = providerRegistry.list();
    expect(providers.some((p) => p.id === "mock")).toBe(false);
  });

  it("lists models from configured providers", async () => {
    const models = await providerRegistry.listModels();
    expect(models.every((m) => m.providerId !== "mock")).toBe(true);
  });

  it("throws for unknown provider", async () => {
    await expect(providerRegistry.health("unknown-xyz")).rejects.toThrow();
  });
});
