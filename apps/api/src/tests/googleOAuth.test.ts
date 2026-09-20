import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleState, verifyGoogleState } from "../lib/googleOAuth.js";

describe("Google OAuth state", () => {
  afterEach(() => vi.useRealTimers());

  it("accepts a freshly signed state", () => {
    expect(verifyGoogleState(createGoogleState())).toBe(true);
  });

  it("rejects a changed state", () => {
    const state = createGoogleState();
    expect(verifyGoogleState(`${state.slice(0, -1)}x`)).toBe(false);
  });

  it("expires after ten minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T00:00:00Z"));
    const state = createGoogleState();
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(verifyGoogleState(state)).toBe(false);
  });
});
