import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, cleanup } from "./helpers.js";
import { prisma } from "../lib/prisma.js";

/**
 * Regression: the first page load fires several requests in parallel with no
 * auth token. Each one hits the dev-user bootstrap in `getUserId`, which used
 * to do find-then-create — so the losers of the race died on the unique
 * constraint for `username` and returned 500.
 */
describe("Concurrent dev-user bootstrap", () => {
  let app: any;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves parallel token-less requests without a unique-constraint 500", async () => {
    await cleanup(); // ensures no dev user exists — the state the race needs

    const endpoints = [
      "/api/sessions",
      "/api/projects",
      "/api/sessions",
      "/api/projects",
      "/api/usage",
      "/api/sessions",
    ];

    const responses = await Promise.all(
      endpoints.map((url) => app.inject({ method: "GET", url }))
    );

    const statuses = responses.map((r) => r.statusCode);
    expect(statuses.every((s) => s < 400)).toBe(true);

    // exactly one dev user, and it is reused rather than duplicated
    const users = await prisma.user.findMany({ where: { email: "dev@localhost" } });
    expect(users).toHaveLength(1);
  });

  it("reuses the existing dev user on later requests", async () => {
    await cleanup();

    const first = await app.inject({ method: "GET", url: "/api/sessions" });
    expect(first.statusCode).toBeLessThan(400);

    const second = await app.inject({ method: "GET", url: "/api/projects" });
    expect(second.statusCode).toBeLessThan(400);

    const users = await prisma.user.findMany({ where: { email: "dev@localhost" } });
    expect(users).toHaveLength(1);
  });
});
