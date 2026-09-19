# Delvin — AI Coding Agent Platform

Branded AI coding-agent workspace built from an Arena-style frontend, now powered by your own backend/services. Full-stack, isolated VPS terminal, approval-gated dangerous commands, SSE streaming, and provider-agnostic LLM routing.

> **Branding:** Delvin keeps its own logo, Oswald/Roboto Slab/Roboto brand fonts and yellow accent, now
> presented through the agent-workspace visual language: warm graphite dark surfaces, an editorial serif
> hero headline with a highlight block, sidebar session history, activity rail, approval banner and a
> workspace terminal. Names, domains and colours stay env-driven via `branding.config.ts` + `PRODUCT_*` env.

## Monorepo

```
apps/api   Fastify 4 + Prisma SQLite (PostgreSQL-ready) + JWT + SSE + terminal + approval
apps/web   Next.js 14 + React 18 + Tailwind 3 + branding.config.ts + SSE client
packages/* (reserved)
pnpm-workspace.yaml  — pnpm 9.12.3, Node >=20
```

## Quick Start (Local)

```bash
pnpm install
# API
cp apps/api/.env.example apps/api/.env  # then edit JWT/ENCRYPTION if needed
pnpm --filter @cumsee/api prisma:generate
pnpm --filter @cumsee/api prisma:migrate   # creates dev.db
pnpm --filter @cumsee/api dev   # http://localhost:4000
# Web
pnpm --filter @cumsee/web dev   # http://localhost:3000  (rewrites /api → 4000)
```

Build & test:

```bash
pnpm build          # tsc + next build
pnpm test           # vitest 36 tests (health/auth/sessions/terminal/path/approval/providers)
pnpm typecheck
```

## Environment

**Never commit `.env`** — only `.env.example` (safe placeholders) is tracked. Generate real secrets:

```bash
openssl rand -base64 48  # JWT_SECRET
openssl rand -hex 16     # ENCRYPTION_KEY (32 hex chars)
```

### apps/api/.env.example
```ini
DATABASE_URL="postgresql://delvin_app:change-me@127.0.0.1:5432/delvin?schema=public"
JWT_SECRET="change-me-please-use-openssl-rand-base64-48"
ENCRYPTION_KEY="change-me-32-hex"
PORT=4000
HOST=0.0.0.0
NODE_ENV=development
PRODUCT_NAME="Delvin"
PRODUCT_DOMAIN="delvin.local"
LOGO_PATH="/assets/logo.png"
FAVICON_PATH="/assets/favicon.ico"
PRIMARY_COLOR="#0ea5e9"
ACCENT_COLOR="#06b6d4"
OMNIROUTE_BASE_URL="http://127.0.0.1:20128/v1"
OMNIROUTE_API_KEY=""
OPENCODE_BASE_URL="https://opencode.ai/zen/v1"
OPENCODE_API_KEY=""
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_API_KEY=""
AGENT_MAX_ITERATIONS=20
WORKSPACE_ROOT="/tmp/cumsee-workspaces"
AGENT_USER="agent"
```

### apps/web/.env.example
```ini
NEXT_PUBLIC_PRODUCT_NAME="Delvin"
NEXT_PUBLIC_PRODUCT_DOMAIN="delvin.local"
NEXT_PUBLIC_LOGO_PATH="/assets/logo.png"
NEXT_PUBLIC_FAVICON_PATH="/assets/favicon.ico"
NEXT_PUBLIC_PRIMARY_COLOR="#0ea5e9"
NEXT_PUBLIC_ACCENT_COLOR="#06b6d4"
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Real production values live in `/home/agent/cumsee-platform/apps/api/.env` (600, `agent:agent`) and systemd `EnvironmentFile` — see `deployment/`.

## Branding

Central config: `apps/web/branding.config.ts` + `apps/api/src/lib/config.ts` (both read `PRODUCT_*` env,
`NEXT_PUBLIC_*` for web). Change once, rebuild web (`NEXT_PUBLIC_*` is baked at build).

| Knob | Env | Notes |
| --- | --- | --- |
| Product name / domain | `PRODUCT_NAME`, `PRODUCT_DOMAIN` | Sidebar, metadata, message attribution |
| Logo / favicon | `LOGO_PATH`, `FAVICON_PATH` | Served from `apps/web/public/assets/` — see **Brand assets** below |
| Theme channels | `PRIMARY_COLOR`, `ACCENT_COLOR`, `HIGHLIGHT_COLOR` | `"H S% L%"` channels surfaced as CSS vars in `app/globals.css` |
| Hero copy | `HERO_TITLE_LEAD`, `HERO_TITLE_TAIL`, `HERO_TITLE_HIGHLIGHT`, `HERO_SUBTITLE` | Headline renders `<LEAD> the <HIGHLIGHT>` |

Design tokens live in `apps/web/app/globals.css` (`--surface-*`, `--text-*`, `--border-*`, `--interactive-*`)
and are mapped in `apps/web/tailwind.config.ts`, so surfaces/typography restyle from one place.

## API

See `docs/API.md` and `docs/ARCHITECTURE.md`. Highlights:

- `GET /api/health`, `/api/ready`, `/api/version`
- `POST /api/auth/register|login`, `GET /api/auth/me`
- `GET/POST /api/projects`, `/api/sessions`, `/api/sessions/:id/messages` (+ mock streaming)
- `GET/POST /api/sessions/:id/terminal/command` (safe → 200, risky → 202 approval_required)
- `POST /api/tool-calls/:id/approve|reject`
- `GET /api/sessions/:id/events` (JSON history) + `/api/sessions/:id/stream?token=...` (SSE, `lastEventId` replay, heartbeat)
- `GET /api/models` (mock + opencode + omniroute compat with 401 fallback)
- Files/git with `validateWorkspacePath` (blocks `..`, `//`, null bytes)

Approval policy: `apps/api/src/lib/approvalPolicy.ts` (high-risk: `rm -rf`, `sudo`, `systemctl`, `curl|bash`, etc. → approval; safe: `ls`, `cat`, `git status`, `echo`, `sleep` → auto).

Agent engine: `apps/api/src/lib/agentEngine.ts` runs an iterative OpenAI-compatible tool loop with persistent tool calls/results, terminal approvals, file tools, SSE progress, bounded iterations, and restart recovery for interrupted runs.

Terminal: `apps/api/src/lib/terminalRunner.ts` (spawn `bash -c`, 30s timeout, 1M output cap, secret redaction `sk-*`, `ghp_*`, `Bearer`, `password`, `api_key`, `token`, sandboxed `HOME=workspaceRoot`). Approved high-risk commands run only after the approval endpoint resumes the agent.

## Frontend

- `apps/web/lib/api.ts` — fetch wrapper (`credentials: include`, `/api` base, `NEXT_PUBLIC_API_URL` override)
- `apps/web/lib/sse.ts` — `EventSource` with `?token=` + `lastEventId` replay + fetch fallback + exponential backoff
- `apps/web/app/page.tsx` — AgentPage (session bootstrap, SSE tool timeline, approvals, terminal, file viewer)
- Components: `SessionSidebar`, `ModelSelector`, `Composer`, `MessageList`, `ToolTimeline`, `Terminal`, `ApprovalBar`, `FileViewer`

## Deployment

See `deployment/` and `docs/DEPLOYMENT.md`:

- `deployment/systemd/cumsee-api.service`, `cumsee-web.service` (User `agent`, `ProtectSystem full`, `ReadWritePaths` limited)
- `deployment/caddy/Caddyfile.example` + `cumsee.caddy` (nip.io example)
- Workspace isolation: `/home/agent/workspaces` (per-project dirs), Prisma `file:prod.db` (PostgreSQL-ready)

Build on VPS (as `agent`):

```bash
pnpm install --frozen-lockfile
npx prisma generate && npx prisma migrate deploy
pnpm build
systemctl restart cumsee-api cumsee-web
caddy validate && systemctl reload caddy
```

## Security

- No secrets in repo — only `.env.example`. Real JWT/encryption/provider keys in `EnvironmentFile` (600) on VPS.
- Terminal jailed, path traversal blocked, secrets redacted, rate-limited (100/min), audit logs.
- VPS was compromised (Go loader `libgdi`, miners `.sshd`/`bsd-port/getty` via `dpkgd` rootkit) — deployment isolates to `agent` user; **reinstall OS clean before production** and harden SSH/firewall.

## License / Source

Authorized clone: `https://github.com/cumseedih/cumseeagent` (reference, inspection only in Phase 1). This repo is your branded fork with own backend — no Arena live APIs.

---
*Generated for safe public push — no .env, node_modules, .next, dist, coverage, or DBs are committed.*

### Brand assets

`apps/web/public/assets/` holds the mark and everything derived from it:

| File | Purpose |
| --- | --- |
| `delvin-logo.jpg` | **Master artwork** (1536×1536). Edit the brand here. |
| `logo.png` | 512px in-app mark — tight crop, raised tile, used by the sidebar, hero and `LOGO_PATH` |
| `favicon.ico` | 16/32/48 multi-size icon |
| `icon-32.png` | 32px PNG for modern browsers |
| `apple-touch-icon.png` | 180px iOS home-screen icon |
| `og.png` | 1200×630 social preview |
| `logo.svg` | SVG wrapper around `logo.png` for tooling that requires a vector entry point |

The artwork is a light figure on a near-white ground, so the small icons bake in a
raised dark tile and use a tight head-and-hat crop — at 20px the wider crop loses the
face against the dark UI. Regenerate by re-running the crop/plate script if the master changes.
