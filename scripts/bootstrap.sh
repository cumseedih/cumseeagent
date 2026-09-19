#!/usr/bin/env bash
#
# One-command bootstrap for a fresh checkout / fresh container.
#
#   ./scripts/bootstrap.sh
#
# Installs the JS toolchain, dependencies, the Prisma client and database,
# then builds the web app. Safe to re-run — every step is idempotent.
#
# The sandbox this project is developed in discards node_modules, build
# output and globally installed tools between sessions, so this script exists
# to make recovery a single command rather than a sequence of remembered fixes.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# pnpm is installed into ~/.local to avoid the EACCES on the system prefix.
export PATH="$HOME/.local/bin:$PATH"
PNPM_VERSION="9.12.3"

say() { printf "\n\033[1m==> %s\033[0m\n" "$1"; }

say "Toolchain"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (>=18). Install it first." >&2
  exit 1
fi
echo "node $(node -v)"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "installing pnpm@${PNPM_VERSION} into ~/.local"
  npm config set prefix "$HOME/.local"
  npm install -g "pnpm@${PNPM_VERSION}" >/dev/null
fi
echo "pnpm $(pnpm -v)"

say "Dependencies"
pnpm install --no-frozen-lockfile

say "API environment"
if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env
  echo "created apps/api/.env from the example — review it before production use"
else
  echo "apps/api/.env already present, leaving it alone"
fi

say "Database"
( cd apps/api && pnpm prisma generate && pnpm prisma migrate deploy )

say "Web build"
( cd apps/web && pnpm build )

cat <<'DONE'

Bootstrap complete.

  API   cd apps/api && pnpm dev      # http://localhost:4000
  Web   cd apps/web && pnpm start    # http://localhost:3000

Both read apps/api/.env. The web app proxies /api/* to the API on port 4000.
DONE
