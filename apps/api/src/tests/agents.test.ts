import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { authHeader, buildTestApp, cleanup, createTestUser } from "./helpers.js";

describe("Agent profiles and Group Chats", () => {
  let app: any;
  let token: string;

  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => {
    await cleanup();
    const user = await createTestUser(app);
    token = user.token;
  });

  it("creates a default Agent and supports profile editing", async () => {
    const initial = await app.inject({ method: "GET", url: "/api/agents", headers: authHeader(token) });
    expect(initial.statusCode).toBe(200);
    const defaultAgent = JSON.parse(initial.body).agents[0];
    expect(defaultAgent.isDefault).toBe(true);

    const created = await app.inject({
      method: "POST", url: "/api/agents", headers: authHeader(token),
      payload: { name: "Code Reviewer", instructions: "Review changes carefully.", memory: "Prefer concise notes." },
    });
    expect(created.statusCode).toBe(201);
    const agent = JSON.parse(created.body).agent;
    expect(agent.instructions).toContain("Review changes");
    expect(agent.memory).toContain("concise");

    const updated = await app.inject({ method: "PATCH", url: `/api/agents/${agent.id}`, headers: authHeader(token), payload: { isPinned: true } });
    expect(JSON.parse(updated.body).agent.isPinned).toBe(true);
    expect((await app.inject({ method: "DELETE", url: `/api/agents/${defaultAgent.id}`, headers: authHeader(token) })).statusCode).toBe(409);
    expect((await app.inject({ method: "PATCH", url: `/api/agents/${defaultAgent.id}`, headers: authHeader(token), payload: { name: "Renamed" } })).statusCode).toBe(409);
  });

  it("keeps Agents private to their account", async () => {
    const created = await app.inject({ method: "POST", url: "/api/agents", headers: authHeader(token), payload: { name: "Private Agent" } });
    const agentId = JSON.parse(created.body).agent.id;
    const other = await createTestUser(app, `other-${Date.now()}@example.com`);
    const update = await app.inject({ method: "PATCH", url: `/api/agents/${agentId}`, headers: authHeader(other.token), payload: { instructions: "stolen" } });
    expect(update.statusCode).toBe(404);
    const list = await app.inject({ method: "GET", url: "/api/agents", headers: authHeader(other.token) });
    expect(JSON.parse(list.body).agents.map((agent: any) => agent.id)).not.toContain(agentId);
  });

  it("creates nonempty Group Chats and enforces owned membership", async () => {
    const list = await app.inject({ method: "GET", url: "/api/agents", headers: authHeader(token) });
    const defaultAgent = JSON.parse(list.body).agents[0];
    const profileResponse = await app.inject({ method: "POST", url: "/api/agents", headers: authHeader(token), payload: { name: "Planner", instructions: "Think in steps." } });
    const profile = JSON.parse(profileResponse.body).agent;

    const created = await app.inject({
      method: "POST", url: "/api/groups", headers: authHeader(token),
      payload: { name: "Review group", agentIds: [defaultAgent.id, profile.id] },
    });
    expect(created.statusCode).toBe(201);
    const group = JSON.parse(created.body).group;
    expect(group.agents).toHaveLength(2);

    const empty = await app.inject({ method: "PATCH", url: `/api/groups/${group.id}`, headers: authHeader(token), payload: { agentIds: [] } });
    expect(empty.statusCode).toBe(400);

    const foreign = await createTestUser(app, `foreign-${Date.now()}@example.com`);
    const foreignAgent = JSON.parse((await app.inject({ method: "GET", url: "/api/agents", headers: authHeader(foreign.token) })).body).agents[0];
    const crossOwner = await app.inject({ method: "POST", url: "/api/groups", headers: authHeader(token), payload: { name: "Invalid group", agentIds: [foreignAgent.id] } });
    expect(crossOwner.statusCode).toBe(400);
  });

  it("assigns sessions to an Agent or Group Chat, never both, and pins history", async () => {
    const agents = JSON.parse((await app.inject({ method: "GET", url: "/api/agents", headers: authHeader(token) })).body).agents;
    const profile = JSON.parse((await app.inject({ method: "POST", url: "/api/agents", headers: authHeader(token), payload: { name: "Researcher" } })).body).agent;
    const group = JSON.parse((await app.inject({ method: "POST", url: "/api/groups", headers: authHeader(token), payload: { name: "Pair", agentIds: [agents[0].id, profile.id] } })).body).group;

    const session = await app.inject({ method: "POST", url: "/api/sessions", headers: authHeader(token), payload: { agentProfileId: profile.id } });
    expect(session.statusCode).toBe(201);
    expect(JSON.parse(session.body).session.agentProfile.id).toBe(profile.id);

    const groupSession = await app.inject({ method: "POST", url: "/api/sessions", headers: authHeader(token), payload: { groupChatId: group.id } });
    expect(groupSession.statusCode).toBe(201);
    expect(JSON.parse(groupSession.body).session.groupChat.id).toBe(group.id);

    const invalid = await app.inject({ method: "POST", url: "/api/sessions", headers: authHeader(token), payload: { agentProfileId: profile.id, groupChatId: group.id } });
    expect(invalid.statusCode).toBe(400);

    const sessionId = JSON.parse(session.body).session.id;
    const pin = await app.inject({ method: "PATCH", url: `/api/sessions/${sessionId}`, headers: authHeader(token), payload: { isPinned: true } });
    expect(JSON.parse(pin.body).session.isPinned).toBe(true);
    const history = JSON.parse((await app.inject({ method: "GET", url: "/api/sessions", headers: authHeader(token) })).body).sessions;
    expect(history[0].id).toBe(sessionId);
  });
});
