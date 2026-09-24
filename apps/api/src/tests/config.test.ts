import { afterEach, describe, expect, it, vi } from "vitest";

describe("production public URL configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("moves legacy Delvin OAuth callback URLs to the active hostname", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_APP_URL", "https://delvin.agentdomains.co");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "https://delvin.agentdomains.co/api/auth/google/callback");
    vi.resetModules();

    const { config } = await import("../lib/config.js");

    expect(config.publicAppUrl).toBe("https://agentdelv.in");
    expect(config.google.redirectUri).toBe("https://agentdelv.in/api/auth/google/callback");
  });

  it("uses the active production hostname when no OAuth URL is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_APP_URL", "");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "");
    vi.resetModules();

    const { config } = await import("../lib/config.js");

    expect(config.publicAppUrl).toBe("https://agentdelv.in");
    expect(config.google.redirectUri).toBe("https://agentdelv.in/api/auth/google/callback");
  });

  it("keeps the local callback host in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "");
    vi.resetModules();

    const { config } = await import("../lib/config.js");

    expect(config.google.redirectUri).toBe("http://localhost:4000/api/auth/google/callback");
  });
});
