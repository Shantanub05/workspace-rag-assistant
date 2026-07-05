#!/usr/bin/env bash
set -euo pipefail

APP_DOMAIN="${APP_DOMAIN:-}"
SITE_NAME="${SITE_NAME:-workspace-rag}"
APP_ROOT="${APP_ROOT:-/home/ubuntu/apps/workspace-rag-assistant}"
ENABLE_CERTBOT="${ENABLE_CERTBOT:-0}"

if [ -z "$APP_DOMAIN" ]; then
  echo "Set APP_DOMAIN before running this script." >&2
  echo "Example: APP_DOMAIN=workspace-rag.example.com bash deploy/ec2/scripts/install-nginx-site.sh" >&2
  exit 1
fi

if ! sudo -n true 2>/dev/null; then
  echo "This script needs passwordless sudo on the EC2 host." >&2
  exit 1
fi

cd "$APP_ROOT"

tmp_file="$(mktemp)"
sed "s/workspace-rag.example.com/$APP_DOMAIN/g" deploy/ec2/nginx.workspace-rag.conf.example >"$tmp_file"

sudo cp "$tmp_file" "/etc/nginx/sites-available/$SITE_NAME"
rm -f "$tmp_file"

if [ ! -e "/etc/nginx/sites-enabled/$SITE_NAME" ]; then
  sudo ln -s "/etc/nginx/sites-available/$SITE_NAME" "/etc/nginx/sites-enabled/$SITE_NAME"
fi

sudo nginx -t
sudo systemctl reload nginx

if [ "$ENABLE_CERTBOT" = "1" ]; then
  sudo certbot --nginx -d "$APP_DOMAIN"
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "Nginx site installed for $APP_DOMAIN."
