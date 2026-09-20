// Central API client — replaces Arena mocks

const BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

async function request(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    credentials: "include",
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  register: (body: any) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: any) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),

  // Projects
  listProjects: () => request("/projects"),
  createProject: (body: any) => request("/projects", { method: "POST", body: JSON.stringify(body) }),
  getProject: (id: string) => request(`/projects/${id}`),

  // Sessions
  listSessions: () => request("/sessions"),
  createSession: (body: any) => request("/sessions", { method: "POST", body: JSON.stringify(body) }),
  getSession: (id: string) => request(`/sessions/${id}`),
  deleteSession: (id: string) => request(`/sessions/${id}`, { method: "DELETE" }),
  stopSession: (id: string) => request(`/sessions/${id}/stop`, { method: "POST" }),

  // Messages
  listMessages: (sessionId: string) => request(`/sessions/${sessionId}/messages`),
  sendMessage: (sessionId: string, body: any) => request(`/sessions/${sessionId}/messages`, { method: "POST", body: JSON.stringify(body) }),

  // Runs
  listRuns: (sessionId: string) => request(`/sessions/${sessionId}/runs`),
  getRun: (runId: string) => request(`/runs/${runId}`),
  pauseRun: (runId: string) => request(`/runs/${runId}/pause`, { method: "POST" }),
  resumeRun: (runId: string) => request(`/runs/${runId}/resume`, { method: "POST" }),
  cancelRun: (runId: string) => request(`/runs/${runId}/cancel`, { method: "POST" }),

  // Plans
  getPlan: (runId: string) => request(`/runs/${runId}/plan`),
  approvePlan: (runId: string) => request(`/runs/${runId}/plan/approve`, { method: "POST" }),
  rejectPlan: (runId: string) => request(`/runs/${runId}/plan/reject`, { method: "POST" }),

  // Tool calls
  listToolCalls: (sessionId: string) => request(`/sessions/${sessionId}/tool-calls`),
  getToolCall: (id: string) => request(`/tool-calls/${id}`),
  approveTool: (id: string) => request(`/tool-calls/${id}/approve`, { method: "POST" }),
  rejectTool: (id: string, reason?: string) => request(`/tool-calls/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),

  // Files
  listFiles: (projectId: string, path?: string) => request(`/projects/${projectId}/files?path=${encodeURIComponent(path || "/")}`),
  getFileContent: (projectId: string, path: string) => request(`/projects/${projectId}/files/content?path=${encodeURIComponent(path)}`),
  createFile: (projectId: string, body: any) => request(`/projects/${projectId}/files`, { method: "POST", body: JSON.stringify(body) }),
  updateFile: (projectId: string, body: any) => request(`/projects/${projectId}/files`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteFile: (projectId: string, path: string) => request(`/projects/${projectId}/files?path=${encodeURIComponent(path)}`, { method: "DELETE" }),

  // Terminal
  listTerminal: (sessionId: string) => request(`/sessions/${sessionId}/terminal`),
  runCommand: (sessionId: string, body: any) => request(`/sessions/${sessionId}/terminal/command`, { method: "POST", body: JSON.stringify(body) }),
  stopCommand: (commandId: string) => request(`/terminal/${commandId}/stop`, { method: "POST" }),

  // Git
  gitStatus: (projectId: string) => request(`/projects/${projectId}/git/status`),
  gitDiff: (projectId: string) => request(`/projects/${projectId}/git/diff`),
  gitCommit: (projectId: string, message: string) => request(`/projects/${projectId}/git/commit`, { method: "POST", body: JSON.stringify({ message }) }),
  gitPush: (projectId: string, approved?: boolean) => request(`/projects/${projectId}/git/push`, { method: "POST", body: JSON.stringify({ approved }) }),
  gitPull: (projectId: string) => request(`/projects/${projectId}/git/pull`, { method: "POST" }),

  // GitHub App connection
  githubStatus: () => request("/github/status"),
  githubRepositories: () => request("/github/repositories"),
  githubClone: (repositoryId: string) => request("/github/repositories/clone", { method: "POST", body: JSON.stringify({ repositoryId }) }),
  githubDisconnect: () => request("/github/connection", { method: "DELETE" }),

  // Models
  listModels: () => request("/models"),
  listProviders: () => request("/providers"),
  providerHealth: (id: string) => request(`/providers/${id}/health`),

  // Events
  listEvents: (sessionId: string) => request(`/sessions/${sessionId}/events`),

  // Usage / credits
  getUsage: () => request("/usage"),

  // Terms of use consent
  getTerms: () => request("/auth/tou"),
  acceptTerms: (version?: string) =>
    request("/auth/tou", { method: "PUT", body: JSON.stringify({ version }) }),

  // Health
  health: () => request("/health"),
  ready: () => request("/ready"),
  version: () => request("/version"),
};
