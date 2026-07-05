#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/apps/workspace-rag-assistant}"
CONFIG_DIR="${CONFIG_DIR:-/home/ubuntu/config/workspace-rag}"
SCRIPT_DIR="${SCRIPT_DIR:-/home/ubuntu/scripts/workspace-rag}"

cd "$APP_DIR"

mkdir -p "$CONFIG_DIR/api" "$CONFIG_DIR/web" "$SCRIPT_DIR"

if [ ! -f "$CONFIG_DIR/api/.env" ]; then
  cp deploy/ec2/api.env.example "$CONFIG_DIR/api/.env"
fi

if [ ! -f "$CONFIG_DIR/web/.env.production" ]; then
  cp deploy/ec2/web.env.production.example "$CONFIG_DIR/web/.env.production"
fi

chmod 600 "$CONFIG_DIR/api/.env" "$CONFIG_DIR/web/.env.production"

ln -sfn "$CONFIG_DIR/api/.env" "$APP_DIR/apps/api/.env"
ln -sfn "$CONFIG_DIR/web/.env.production" "$APP_DIR/apps/web/.env.production"

cp deploy/ec2/scripts/deploy.sh "$SCRIPT_DIR/deploy.sh"
cp deploy/ec2/scripts/ecosystem.config.js "$SCRIPT_DIR/ecosystem.config.js"
chmod +x "$SCRIPT_DIR/deploy.sh"

echo "Installed server files:"
echo "- $CONFIG_DIR/api/.env"
echo "- $CONFIG_DIR/web/.env.production"
echo "- $SCRIPT_DIR/deploy.sh"
echo "- $SCRIPT_DIR/ecosystem.config.js"
echo
echo "Edit the env files and replace placeholders before deploying."
