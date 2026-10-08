# Deployment

## VPS (Debian 11, 2 vCPU, 7.8 GiB, 50 GiB)
The initial VPS was compromised by miners/rootkit (`libgdi`, `dpkgd`). **Do not connect or deploy until the user explicitly confirms the VPS has been rebuilt with a clean OS.** After rebuild, rotate all potentially exposed credentials and verify hardening before production.

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
DATABASE_URL=postgresql://cumsee_app:REPLACE_WITH_ROTATED_SECRET@127.0.0.1:5432/cumsee_prod?schema=public
JWT_SECRET=$(openssl rand -base64 48)      # 64 hex or base64
ENCRYPTION_KEY=$(openssl rand -hex 16)     # 32 hex
WORKSPACE_ROOT=/home/agent/workspaces
AGENT_USER=agent
PRODUCT_NAME="Delvin"
PRODUCT_DOMAIN="your.domain.com"
OMNIROUTE_BASE_URL="http://127.0.0.1:20128/v1"
# set real provider keys via EnvironmentFile, never in repo

# /home/agent/cumsee-platform/apps/web/.env
NEXT_PUBLIC_PRODUCT_NAME="Delvin"
NEXT_PUBLIC_API_URL="https://your.domain.com/api"
```

### 5. Install & Migrate (as agent)
```bash
cd /home/agent/cumsee-platform
pnpm install --frozen-lockfile
pnpm --filter @cumsee/api exec prisma generate
pnpm --filter @cumsee/api exec prisma migrate deploy  # applies PostgreSQL migrations
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
- [ ] Confirm the clean OS rebuild before connecting; restore only approved, scanned project/database backups and rotate all credentials first
- [ ] `PasswordAuthentication no`, `PermitRootLogin prohibit-password`, port 22 → nonstandard, `fail2ban`/`ufw allow 22,80,443`
- [ ] `iptables -P INPUT DROP` (was ACCEPT)
- [ ] Rotate all tokens: `JWT_SECRET`, `ENCRYPTION_KEY`, `OMNIROUTE_API_KEY`, `OPENAI_API_KEY`, Telegram bot tokens
- [ ] Provision PostgreSQL with a dedicated least-privilege service role; store the rotated connection secret only in the protected environment file
- [ ] TLS via real domain (Caddy `tls { ca }`), not `tls internal` nip.io demo
- [ ] Backups: encrypted, access-controlled `pg_dump -Fc` backups with restore tests
- [ ] Monitoring: `systemd` watchdog, `caddy.log`, `prometheus` health

### 10. Rollback
```bash
systemctl stop cumsee-api cumsee-web
cp /etc/caddy/Caddyfile.bak.* /etc/caddy/Caddyfile; systemctl reload caddy
# rm -rf /home/agent/cumsee-platform; systemctl disable cumsee-*
```

Backups: `Caddyfile.bak.*`, PostgreSQL dump, and `/home/agent/workspaces` archive.
