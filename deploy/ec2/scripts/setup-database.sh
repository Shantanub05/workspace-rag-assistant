#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-workspace_rag}"
DB_USER="${DB_USER:-workspace_rag_app}"

if [ -z "${DB_PASSWORD:-}" ]; then
  echo "Set DB_PASSWORD before running this script." >&2
  echo "Example: DB_PASSWORD=\"$(openssl rand -base64 32)\" bash deploy/ec2/scripts/setup-database.sh" >&2
  exit 1
fi

if ! sudo -n true 2>/dev/null; then
  echo "This script needs passwordless sudo on the EC2 host." >&2
  exit 1
fi

echo "== ensuring database role =="
if sudo -u postgres psql -Atqc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER';" | grep -qx '1'; then
  echo "role $DB_USER already exists"
else
  sudo -u postgres createuser "$DB_USER"
fi

sudo -u postgres psql -v db_password="$DB_PASSWORD" -v db_user="$DB_USER" -v ON_ERROR_STOP=1 <<'SQL'
ALTER ROLE :"db_user" WITH LOGIN PASSWORD :'db_password';
SQL

echo
echo "== ensuring database =="
if sudo -u postgres psql -Atqc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME';" | grep -qx '1'; then
  echo "database $DB_NAME already exists"
else
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi

echo
echo "== enabling pgvector =="
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
SQL

echo
echo "Database ready."
echo "Use this DATABASE_URL in apps/api/.env:"
echo "postgresql://$DB_USER:<DB_PASSWORD>@127.0.0.1:5432/$DB_NAME?schema=public"
