import { afterEach, describe, expect, it, vi } from "vitest";
import { createGitHubState, verifyGitHubState } from "../lib/githubApp.js";

describe("GitHub connection state", () => {
  afterEach(() => vi.useRealTimers());

  it("round-trips a signed state", () => {
    expect(verifyGitHubState(createGitHubState("user-123"))).toBe("user-123");
  });

  it("rejects a modified state", () => {
    const state = createGitHubState("user-123");
    expect(verifyGitHubState(`${state.slice(0, -1)}x`)).toBeNull();
  });

  it("expires state after 30 minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T00:00:00Z"));
    const state = createGitHubState("user-123");
    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    expect(verifyGitHubState(state)).toBeNull();
  });
});
