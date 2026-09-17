# Deployment

## VPS (Debian 11, 2 vCPU, 7.8 GiB, 50 GiB)
Initial host `sandbox` had miners via `/.mod` + `libgdi` + `dpkgd` rootkit — deploy isolates to `agent` user; **reinstall OS clean before production**.

### 1. User & Workspace
```bash
useradd -m -s /bin/bash agent
mkdir -p /home/agent/workspaces /home/agent/.npm
chown -R agent:agent /home/agent
```

### 2. Backup
```bash
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d%H%M)
```

### 3. Code (as agent)
```bash
# from local: tar excluding node_modules/.next/dist/coverage/*.db, SFTP to /home/agent/cumsee-deploy.tar.gz, extract as agent
tar -xzf cumsee-deploy.tar.gz  # → /home/agent/cumsee-platform
```

### 4. Env (600, agent:agent)
```bash
# /home/agent/cumsee-platform/apps/api/.env
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
DATABASE_URL=file:/home/agent/cumsee-platform/apps/api/prisma/prod.db
JWT_SECRET=$(openssl rand -base64 48)      # 64 hex or base64
ENCRYPTION_KEY=$(openssl rand -hex 16)     # 32 hex
WORKSPACE_ROOT=/home/agent/workspaces
AGENT_USER=agent
PRODUCT_NAME="My Agent"
PRODUCT_DOMAIN="your.domain.com"
OMNIROUTE_BASE_URL="http://127.0.0.1:20128/v1"
# set real provider keys via EnvironmentFile, never in repo

# /home/agent/cumsee-platform/apps/web/.env
NEXT_PUBLIC_PRODUCT_NAME="My Agent"
NEXT_PUBLIC_API_URL="https://your.domain.com/api"
```

### 5. Install & Migrate (as agent)
```bash
cd /home/agent/cumsee-platform
pnpm install --frozen-lockfile
npx --filter @cumsee/api prisma generate
npx --filter @cumsee/api prisma migrate deploy  # creates prod.db
pnpm build  # api tsc + web next build
```

### 6. systemd
Copy `deployment/systemd/*` to `/etc/systemd/system/`:

```bash
cp deployment/systemd/cumsee-api.service /etc/systemd/system/
cp deployment/systemd/cumsee-web.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cumsee-api cumsee-web
systemctl status cumsee-api cumsee-web
journalctl -u cumsee-api -f
curl http://127.0.0.1:4000/api/health
curl http://127.0.0.1:3000/
```

Security snippet (already in templates): `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem full`, `ReadWritePaths` limited.

### 7. Caddy
```bash
cp deployment/caddy/cumsee.caddy /etc/caddy/cumsee.caddy
echo "import /etc/caddy/cumsee.caddy" >> /etc/caddy/Caddyfile
caddy fmt --overwrite /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
chown -R caddy:caddy /var/log/caddy; touch /var/log/caddy/cumsee.log; chown caddy:caddy /var/log/caddy/cumsee.log
systemctl reload caddy
curl -H "Host: your.domain.com" http://127.0.0.1/api/health
```

Example `cumsee.caddy` (template): `my-agent.example.com → 127.0.0.1:3000` + `/api/* → 127.0.0.1:4000`.

### 8. Health Checks
```bash
curl http://127.0.0.1:4000/api/health  # {"status":"ok","product":"My Agent"}
curl http://127.0.0.1:4000/api/ready   # {"status":"ready","db":"connected"}
curl http://127.0.0.1:4000/api/models  # 70+ models (mock fallback if omniroute 401)
curl http://127.0.0.1:3000/ | grep "My Agent"
```

E2E (python):
```bash
curl -X POST http://127.0.0.1:4000/api/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"test123456"}'
# -> token, create session, POST /messages, GET /sessions/:id/stream?token= -> text/event-stream
```

### 9. Hardening Checklist
- [ ] Reinstall OS clean (snapshot workspaces/prod.db dump first)
- [ ] `PasswordAuthentication no`, `PermitRootLogin prohibit-password`, port 22 → nonstandard, `fail2ban`/`ufw allow 22,80,443`
- [ ] `iptables -P INPUT DROP` (was ACCEPT)
- [ ] Rotate all tokens: `JWT_SECRET`, `ENCRYPTION_KEY`, `OMNIROUTE_API_KEY`, `OPENAI_API_KEY`, Telegram bot tokens
- [ ] Switch DB to PostgreSQL: `DATABASE_URL=postgresql://agent:PASS@localhost:5432/cumsee_prod` + `prisma migrate deploy`
- [ ] TLS via real domain (Caddy `tls { ca }`), not `tls internal` nip.io demo
- [ ] Backups: nightly `sqlite3 prod.db .dump | gzip > /home/agent/backups/prod.db.$(date +%F).gz` (if staying SQLite)
- [ ] Monitoring: `systemd` watchdog, `caddy.log`, `prometheus` health

### 10. Rollback
```bash
systemctl stop cumsee-api cumsee-web
cp /etc/caddy/Caddyfile.bak.* /etc/caddy/Caddyfile; systemctl reload caddy
# rm -rf /home/agent/cumsee-platform; systemctl disable cumsee-*
```

Backups: `Caddyfile.bak.*`, `prod.db` copy, `/home/agent/workspaces` tar.
