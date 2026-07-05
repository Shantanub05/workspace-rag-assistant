# EC2 Deployment

This app can run on the existing EC2 host without disturbing the current apps if it uses a separate app directory, database, PM2 process names, local ports, and Nginx site.

## Current Host Pattern
- App root: `/home/ubuntu/apps/<app-name>`
- Existing apps: `proctorpal`, `interviewcoach`
- Process manager: PM2 under the `ubuntu` user
- Reverse proxy: Nginx site files in `/etc/nginx/sites-available`
- Public ingress: only `22`, `80`, and `443`; app ports stay private

## Target Layout
- Repo: `/home/ubuntu/apps/workspace-rag-assistant`
- API env: `/home/ubuntu/apps/workspace-rag-assistant/apps/api/.env`
- Web env: `/home/ubuntu/apps/workspace-rag-assistant/apps/web/.env.production`
- API process: `workspace-rag-api` on `127.0.0.1:4100`
- Web process: `workspace-rag-web` on `127.0.0.1:3100`
- Database: local Postgres database `workspace_rag`
- Database user: `workspace_rag_app`

## One-Time Server Prep

Run this over SSH:

```bash
ssh -F /dev/null -i /home/roxiler/Downloads/ec2-key.pem -o IdentitiesOnly=yes ubuntu@13.203.58.41
```

Install pgvector for the existing PostgreSQL 18 server:

```bash
sudo apt update
sudo apt install -y postgresql-18-pgvector
```

Recommended on this t3.small because it currently has no swap:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Create a database password locally:

```bash
openssl rand -base64 32
```

Create the isolated DB and enable pgvector:

```bash
sudo -u postgres psql
```

```sql
CREATE USER workspace_rag_app WITH PASSWORD 'replace-with-db-password';
CREATE DATABASE workspace_rag OWNER workspace_rag_app;
\connect workspace_rag
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

## App Checkout

```bash
cd /home/ubuntu/apps
git clone https://github.com/Shantanub05/workspace-rag-assistant.git
cd workspace-rag-assistant
export PATH=/home/ubuntu/.nvm/versions/node/v22.22.3/bin:$PATH
corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm install --frozen-lockfile
```

Create real env files from the samples:

```bash
cp deploy/ec2/api.env.example apps/api/.env
cp deploy/ec2/web.env.production.example apps/web/.env.production
chmod 600 apps/api/.env apps/web/.env.production
```

Edit both files and replace placeholders. The app needs a real domain with HTTPS for production cookies.

## Build, Migrate, Seed

```bash
pnpm db:deploy
pnpm db:seed
pnpm build
```

## PM2

```bash
export PATH=/home/ubuntu/.nvm/versions/node/v22.22.3/bin:$PATH
pm2 start deploy/ec2/ecosystem.config.cjs
pm2 save
pm2 list
```

## Nginx

Use a dedicated domain such as `workspace-rag.example.com`; do not reuse the existing app domains.

```bash
sudo cp deploy/ec2/nginx.workspace-rag.conf.example /etc/nginx/sites-available/workspace-rag
sudo nano /etc/nginx/sites-available/workspace-rag
sudo ln -s /etc/nginx/sites-available/workspace-rag /etc/nginx/sites-enabled/workspace-rag
sudo nginx -t
sudo systemctl reload nginx
```

Enable HTTPS:

```bash
sudo certbot --nginx -d workspace-rag.example.com
```

After Certbot completes, confirm Nginx still validates:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Smoke Test

```bash
curl https://workspace-rag.example.com/api/health
```

Then open `https://workspace-rag.example.com` and use the reviewer flow from `README.md`.
