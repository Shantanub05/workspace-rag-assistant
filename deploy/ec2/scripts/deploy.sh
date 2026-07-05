#!/bin/bash
set -e

# Load NVM so node/pnpm/pm2 are available in script context.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

APP_DIR="${APP_DIR:-/home/ubuntu/apps/workspace-rag-assistant}"
CONFIG_DIR="${CONFIG_DIR:-/home/ubuntu/config/workspace-rag}"
ECOSYSTEM="${ECOSYSTEM:-/home/ubuntu/scripts/workspace-rag/ecosystem.config.js}"
BRANCH="${BRANCH:-main}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:4100/health}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-http://127.0.0.1:3100}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Workspace RAG Deploy Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Checking env files..."
[ -f "$CONFIG_DIR/api/.env" ] || { echo "API .env missing at $CONFIG_DIR/api/.env"; exit 1; }
[ -f "$CONFIG_DIR/web/.env.production" ] || { echo "Web .env.production missing at $CONFIG_DIR/web/.env.production"; exit 1; }
[ -L "$APP_DIR/apps/api/.env" ] || { echo "API .env symlink missing at $APP_DIR/apps/api/.env"; exit 1; }
[ -L "$APP_DIR/apps/web/.env.production" ] || { echo "Web .env.production symlink missing at $APP_DIR/apps/web/.env.production"; exit 1; }
[ -f "$ECOSYSTEM" ] || { echo "PM2 ecosystem config missing at $ECOSYSTEM"; exit 1; }

if grep -REq 'replace-with|workspace-rag\.example\.com' "$CONFIG_DIR/api/.env" "$CONFIG_DIR/web/.env.production"; then
  echo "Env files still contain placeholders. Replace them before deploying." >&2
  exit 1
fi
echo "Env files OK"

echo "Pulling latest code..."
cd "$APP_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "Installing dependencies..."
corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm install --frozen-lockfile

echo "Running DB migrations and seed..."
pnpm db:deploy
pnpm db:seed

echo "Building applications..."
pnpm build

echo "Restarting PM2..."
if pm2 list | grep -q "workspace-rag"; then
  pm2 reload "$ECOSYSTEM" --update-env
else
  pm2 start "$ECOSYSTEM"
fi
pm2 save

echo "Running local smoke checks..."
curl --fail --silent --show-error "$API_HEALTH_URL"
echo
curl --fail --head --silent --show-error "$WEB_HEALTH_URL" | sed -n '1,8p'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 status
