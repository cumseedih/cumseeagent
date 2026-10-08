# API Reference

Base: `/api` (local) or `http://localhost:4000/api` / `https://my-agent.example.com/api`

All JSON, `credentials: include`, rate limit `100/min` (`x-ratelimit-*`), CORS `origin: true`.

## Health
- `GET /api/health` → `{status:"ok", timestamp, uptime, version:"0.1.0", product}` 
- `GET /api/ready` → `{status:"ready", db:"connected"}` or 503
- `GET /api/version` → `{version}`
- `GET /` → `{name, domain, version, status}`

## Auth
- `POST /api/auth/register` `{email, password, username?}` → 201 `{user, token}` + `Set-Cookie token` (httpOnly)
- `POST /api/auth/login` `{email, password}` → 200 `{user, token}`
- `GET /api/auth/me` `Authorization: Bearer <token>` or cookie → 200 `{user}` / 401
- `POST /api/auth/logout` → clears cookie

`getUserId` checks `?token=` (for SSE EventSource) → cookie → `Bearer`.

## Projects
- `POST /api/projects` `{name, repositoryUrl?}` → 201 `{project}` (also creates workspace dir)
- `GET /api/projects` → `{projects}`
- `GET /api/projects/:id` → `{project}`
- `PATCH /api/projects/:id` `{name?}` → `{project}`
- `DELETE /api/projects/:id` → 204

## Sessions
- `POST /api/sessions` `{projectId?, title?, selectedModel?, selectedProvider?, agentProfileId?, groupChatId?}` → 201 `{session}`; a chat can target either an owned Agent or Group Chat (emits `session.created`)
- `GET /api/sessions` → `{sessions}` (own only, 403 else)
- `GET /api/sessions/:id` → `{session}`
- `PATCH /api/sessions/:id` `{title?, status?, isPinned?}` → `{session}`
- `DELETE /api/sessions/:id` → 204
- `POST /api/sessions/:id/stop` → pauses run

## Messages
- `GET /api/sessions/:id/messages` → `{messages}`
- `POST /api/sessions/:id/messages` `{role:"user", content, effort?}` → 201 `{message, agentRun}`; starts a provider-backed asynchronous agent run and emits plan/tool/progress events

## Runs / Plans
- `GET /api/sessions/:id/runs` → `{runs}`
- `GET /api/runs/:id` → `{run}`
- `POST /api/runs/:id/pause|resume|cancel`
- `GET /api/runs/:id/plan` → `{plan}`
- `POST /api/runs/:id/plan/approve|reject`

## Tool Calls
- `GET /api/sessions/:id/tool-calls` → `{toolCalls}`
- `GET /api/tool-calls/:id` → `{toolCall}`
- `POST /api/tool-calls/:id/approve` → `{toolCall, approval}`
- `POST /api/tool-calls/:id/reject` `{reason?}` → `{toolCall}`

## Terminal
- `POST /api/sessions/:id/terminal/command` `{command, workingDirectory?}` → 200 `{result:{stdout,stderr,exitCode}}` if safe, else 202 `{status:"approval_required", toolCallId}` (use `classifyRisk`)
- `GET /api/sessions/:id/terminal` → `{commands}`
- `POST /api/terminal/:id/stop` → stops

Auto-approved commands are limited to the basic allowlist (for example `pwd`, workspace-relative `ls`/`cat`, `git status/diff/log`, tests, `echo`, and `sleep`); only `&&` chains whose every segment is independently safe are allowed. Parent traversal, absolute/home paths, sensitive files (`.env`, SSH/cloud/Git credentials, private keys), shell expansion/operators, branch deletion, and unknown/high-risk commands require approval. This approval gate is not an OS/container sandbox.

Redaction: `sk-*`, `ghp_*`, `Bearer`, `password=`, `api_key=`, `token=` → `***REDACTED***`.

## Files
- `GET /api/projects/:id/files?path=/` → `{files:[{name, path, type, size}]}`
- `GET /api/projects/:id/files/content?path=...` → `{content}`
- `POST /api/projects/:id/files` `{path, content}` → 201
- `PATCH /api/projects/:id/files` `{path, content}` → 200
- `DELETE /api/projects/:id/files?path=...` → 204
- Also `GET /api/sessions/:id/files?path=` alias (resolves via session.projectId)

Path validation: blocks `..`, absolute outside workspace, null bytes; `"/"` → workspace root.

## Git
- `GET /api/projects/:id/git/status` → `{status}`
- `GET /api/projects/:id/git/diff` → `{diff}`
- `POST /api/projects/:id/git/commit` `{message}` → `{result}`
- `POST /api/projects/:id/git/push` `{approved?:boolean}` → requires approval if push to remote
- `POST /api/projects/:id/git/pull` → `{result}`

## Models / Providers
- `GET /api/models` → configured provider models; agent runs require a real production provider (mock selections are not used for execution)
- `GET /api/providers` → `{providers}`
- `GET /api/providers/:id/health` → `{status:"ok"}` or error

## Events
- `GET /api/sessions/:id/events?limit=100` → `{events:[{id, sessionId, eventType, payload, createdAt}]}` (auth: 403 if not owner)
- `GET /api/sessions/:id/stream?token=&lastEventId=` → `200 text/event-stream` (SSE), headers `Cache-Control: no-cache, Connection: keep-alive, X-Accel-Buffering: no`, frames `id: | event: | data: {...}\n\n`, history replay since `lastEventId`, heartbeat `: heartbeat` every 15s, subscribe via `eventBus`.

Named events include `session.created`, `agent.started/thinking/plan.generating/plan.created/plan.updated/plan.unavailable/member.started/member.completed/completed/failed`, tool lifecycle events, file events, and `notification.created`.

## Agent Library
- `GET /api/agents` → user-owned Agent profiles (creates the user’s default Agent if needed); `POST /api/agents` `{name, instructions?, memory?}`; `PATCH /api/agents/:id` edits owned profiles; `DELETE /api/agents/:id` (the default Agent is protected).
- `GET /api/groups` → owned Group Chats; `POST /api/groups` `{name, agentIds}` and `PATCH /api/groups/:id` require a nonempty list of owned Agent profiles; `DELETE /api/groups/:id`. Group sessions produce ordered, attributed conversational replies without workspace tools.
- `GET /api/artifacts?projectId=&sessionId=` → up to 100 artifacts owned by the signed-in user.
- `GET /api/artifacts/:id/content` → `{artifact, content}`; verifies ownership, resolves only inside the artifact workspace, and rejects files over 2 MB.
- `GET /api/skills` → user-owned Skills with plain-text `instructions` (implementation JSON remains private).
- `POST /api/skills` `{name, description?, instructions}`; `PATCH /api/skills/:id` `{name?, description?, instructions?, enabled?}`; `DELETE /api/skills/:id`.
- Enabled Skills are appended as user-level guidance to new agent-run system context; executable skill code is not accepted.
- `GET /api/workflows` → user-owned reusable manual workflows and the three most recent run summaries.
- `POST /api/workflows` `{name, description?, prompt, projectId?}`; `PATCH /api/workflows/:id` supports the same fields plus `enabled`; `DELETE /api/workflows/:id`.
- `POST /api/workflows/:id/run` starts a fresh session and audited agent run from the saved prompt, checks the daily run allowance, and updates the workflow-run status on completion or failure. Scheduled triggers are not enabled.

Frontend uses `connectSSE` (EventSource with `?token=` + `lastEventId`).

## Errors
- 400 `{error:"Invalid payload", details}`
- 401 `{error:"Not authenticated"|"Invalid credentials"}`
- 403 `{error:"Forbidden"}`
- 404 `{error:"Session not found"}`
- 429 rate-limit
- 500 `{error:"Internal"}`

## Branding
`GET /` and `/api/health` include `product` from `PRODUCT_NAME` env.
