# Architecture

## Repo
- `pnpm-workspace.yaml` — `apps/*`, `packages/*`
- `apps/api` — Fastify 4.28 + @fastify/{cors,cookie,rate-limit,sensible} + Prisma 5.22 + JWT + SSE
- `apps/web` — Next 14.2 + React 18 + Tailwind 3.4

## Backend
- `src/app.ts` — builds Fastify app, registers `cors` (origin true), `cookie`, `sensible`, `rateLimit`, mounts `/api/*` and `/` health
- `src/server.ts` — starts on `HOST:PORT` (default 0.0.0.0:4000), ensures `WORKSPACE_ROOT` exists
- `src/lib/config.ts` — reads `PORT/HOST/NODE_ENV/DATABASE_URL/JWT_SECRET/ENCRYPTION_KEY/WORKSPACE_ROOT/AGENT_USER` + branding + provider keys
- `src/lib/auth.ts` — bcrypt, `signToken`/`verifyToken` (7d), `extractToken`
- `src/lib/events.ts` — in-memory `EventBus` per session, `emitEvent` → `Event` table + SSE broadcast, `getHistorySince(lastEventId)`
- `src/lib/pathValidator.ts` — `validateWorkspacePath(root, requested)` — resolves, blocks `..`, absolute outside, null bytes; maps `"/"`→ root
- `src/lib/approvalPolicy.ts` — explicit safe-command allowlist; only independently safe `&&` segments auto-run. Parent traversal, absolute/home paths, sensitive files, shell expansion/operators, Git branch deletion, unknown commands, and high-risk commands require approval.
- `src/lib/terminalRunner.ts` — `spawn("bash",["-c",cmd])`, timeout 30s, 1MB cap, secret redaction, workspace working directory and `HOME`; command approvals and path validation are not a container/VM isolation boundary
- `src/lib/agentEngine.ts` — model-generated plans and progress, newest-50-message context, Agent instructions/memory/Skills, bounded provider/tool loop, approval handling, sequential tool-free Group Chat replies, and interrupted-run recovery
- `src/lib/providers/*` — `Provider` interface + `MockProvider` + `OpenAICompatible` (OmniRoute/Opencode/OpenAI) + `registry` (listModels merges mock+opencode+omniroute, 401 fallback)

## DB (Prisma PostgreSQL)
- `prisma/schema.prisma` — User, AgentProfile, GroupChat, GroupChatMember, Project, Session, Message, AgentRun, generated Plan, ToolCall, TerminalCommand, FileChange, Event, Approval, AuditLog, and library entities
- Apply committed migrations with `prisma migrate deploy`; configure the database using `DATABASE_URL=postgresql://...`

## API Routes (under `/api`)
- `health` — `GET /health`, `/ready`, `/version`, `GET /` branding
- `auth` — `POST /auth/register|login` (bcrypt + `setCookie token` + `auditLog`), `GET /auth/me`, `POST /logout`; helper `getUserId` checks `?token`/`cookie`/`Bearer` else dev user
- `projects` — CRUD, `workspacePath` unique
- `sessions` — owner-scoped CRUD, Agent/Group assignment, pinned history, and selected model/provider
- `messages` — `GET/POST /sessions/:id/messages` (validates content and starts the provider-backed engine; generated plans are persisted and streamed)
- `runs/plans` — AgentRun lifecycle, plan JSON
- `agents` — owner-scoped Agent profiles and nonempty Group Chat membership; `library` — Artifacts, instruction-only Skills, and reusable manual Workflows with fresh-session runs
- `toolCalls` — `GET /sessions/:id/tool-calls`, `POST /tool-calls/:id/approve|reject` (creates `Approval`, emits `tool.approved/rejected`)
- `terminal` — `POST /sessions/:id/terminal/command` (safe→200, risky→202 `approval_required`), `GET /sessions/:id/terminal`
- `files`/`git` — list/content/create/patch/delete with `validateWorkspacePath`, `git status/diff/commit/push/pull`
- `models` — `GET /models`, `/providers`, `/providers/:id/health`
- `events` — `GET /sessions/:id/events` (JSON) + `GET /sessions/:id/stream` (SSE, `lastEventId` replay, heartbeat `: heartbeat` every 15s)

## Frontend
- `apps/web/branding.config.ts` — `PRODUCT_NAME/DOMAIN/LOGO/FAVICON/PRIMARY/ACCENT` from `NEXT_PUBLIC_*` or `PRODUCT_*`
- `app/layout.tsx` — sets `metadata` + `:root{--primary/--accent}`
- `app/page.tsx` — `AgentPage`: `api.listSessions`, `api.createSession`, `connectSSE`, `ToolTimeline`, approvals, terminal, file viewer
- `lib/api.ts` — `fetch(${BASE}${path}, {credentials:include})`, `BASE=NEXT_PUBLIC_API_URL||/api`, covers auth/projects/sessions/messages/runs/plans/toolCalls/files/terminal/git/models/events/health
- `lib/sse.ts` — `connectSSE(sessionId, onEvent)` — builds `/api/sessions/:id/stream?lastEventId=&token=` (token from `localStorage cumsee_token|token`), `EventSource` + named events listen + `fetchStream` fallback, retry 1s→10s
- `next.config.js` — `rewrites: /api → http://127.0.0.1:4000` (local), `typescript ignore` for prod
- Components: `SessionSidebar`, `WorkspaceHub` (Agents, Group Chats, projects, Artifacts, Skills, manual Workflows, integrations, settings), `Composer`, `MessageList`, generated `TaskPlanPanel`, `Terminal`, `ApprovalBar`, `FileViewer`; `globals.css` Delvin Cream & Grove theme

## Deployment
- `deployment/systemd/*` + `deployment/caddy/*`
- Workspace: `/home/agent/workspaces` (per-project dirs), `AGENT_USER=agent`
- Health: `systemctl status cumsee-api/web`, `curl :4000/api/health`, `journalctl -u`

## Tests
- `vitest` + `coverage-v8`; integration coverage includes health/auth, sessions and pinning, Agent profiles/Group Chats, library APIs, terminal/approval, path traversal, and providers

## Security
- JWT httpOnly `sameSite lax`, bcrypt 10, path validation, approval gate, timeout 30s, output cap 1MB, secret redaction, rate limit 100/min, audit logs, and systemd restrictions. Shell commands are not container-isolated.
