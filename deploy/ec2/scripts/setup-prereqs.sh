#!/usr/bin/env bash
set -euo pipefail

NODE_BIN_DIR="${NODE_BIN_DIR:-/home/ubuntu/.nvm/versions/node/v22.22.3/bin}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

if ! sudo -n true 2>/dev/null; then
  echo "This script needs passwordless sudo on the EC2 host." >&2
  exit 1
fi

echo "== installing pgvector package =="
sudo apt update
sudo apt install -y postgresql-18-pgvector

echo
echo "== ensuring swap =="
if swapon --show=NAME | grep -qx '/swapfile'; then
  echo "/swapfile is already active"
else
  if [ ! -f /swapfile ]; then
    sudo fallocate -l "$SWAP_SIZE" /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
  fi
  sudo swapon /swapfile
fi

if ! grep -qE '^/swapfile\s+none\s+swap\s+' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo
echo "== preparing pnpm =="
export PATH="$NODE_BIN_DIR:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Node was not found at $NODE_BIN_DIR. Install Node 22 with nvm first." >&2
  exit 1
fi
corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm --version
