import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp } from "./helpers.js";

describe("Health", () => {
  let app: any;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
  });

  it("GET /api/ready returns ready when DB connected", async () => {
    const res = await app.inject({ method: "GET", url: "/api/ready" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ready");
  });

  it("GET /api/version returns version", async () => {
    const res = await app.inject({ method: "GET", url: "/api/version" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.version).toBeDefined();
  });
});
