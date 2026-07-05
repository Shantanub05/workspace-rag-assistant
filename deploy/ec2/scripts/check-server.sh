#!/usr/bin/env bash
set -euo pipefail

NODE_BIN_DIR="${NODE_BIN_DIR:-/home/ubuntu/.nvm/versions/node/v22.22.3/bin}"
export PATH="$NODE_BIN_DIR:$PATH"

echo "== host =="
hostnamectl 2>/dev/null | sed -n '1,8p' || true
uptime

echo
echo "== capacity =="
printf 'vcpus: '
nproc
free -h
df -hT --exclude-type=tmpfs --exclude-type=devtmpfs

echo
echo "== runtimes =="
for cmd in node npm corepack pnpm pm2 git nginx psql; do
  if command -v "$cmd" >/dev/null 2>&1; then
    printf '%s: ' "$cmd"
    "$cmd" --version 2>&1 | head -1
  else
    printf '%s: missing\n' "$cmd"
  fi
done

echo
echo "== pm2 workspace-rag processes =="
if command -v pm2 >/dev/null 2>&1; then
  pm2 list | grep -E 'workspace-rag|App name|name|─' || true
else
  echo "pm2 missing"
fi

echo
echo "== ports =="
if sudo -n true 2>/dev/null; then
  sudo ss -tulpn | grep -E ':(80|443|3100|4100|5432)\b' || true
else
  ss -tuln | grep -E ':(80|443|3100|4100|5432)\b' || true
fi

echo
echo "== postgres vector extension =="
if command -v psql >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  sudo -u postgres psql -Atqc "SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'vector';" || true
else
  echo "psql or sudo unavailable"
fi

echo
echo "== nginx config =="
if sudo -n true 2>/dev/null; then
  sudo nginx -t
else
  echo "sudo unavailable"
fi
