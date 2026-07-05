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
- API config: `/home/ubuntu/config/workspace-rag/api/.env`
- Web config: `/home/ubuntu/config/workspace-rag/web/.env.production`
- API env symlink: `/home/ubuntu/apps/workspace-rag-assistant/apps/api/.env`
- Web env symlink: `/home/ubuntu/apps/workspace-rag-assistant/apps/web/.env.production`
- Deploy script: `/home/ubuntu/scripts/workspace-rag/deploy.sh`
- PM2 config: `/home/ubuntu/scripts/workspace-rag/ecosystem.config.js`
- API process: `workspace-rag-api` on `127.0.0.1:4100`
- Web process: `workspace-rag-web` on `127.0.0.1:3100`
- Database: local Postgres database `workspace_rag`
- Database user: `workspace_rag_app`

## App Checkout

Run this over SSH:

```bash
ssh -F /dev/null -i /home/roxiler/Downloads/ec2-key.pem -o IdentitiesOnly=yes ubuntu@13.203.58.41
```

Check out the app:

```bash
cd /home/ubuntu/apps
git clone https://github.com/Shantanub05/workspace-rag-assistant.git
cd workspace-rag-assistant
export PATH=/home/ubuntu/.nvm/versions/node/v22.22.3/bin:$PATH
```

Install the server-level config/script layout:

```bash
bash deploy/ec2/scripts/install-server-files.sh
```

This creates:

```text
/home/ubuntu/config/workspace-rag/api/.env
/home/ubuntu/config/workspace-rag/web/.env.production
/home/ubuntu/scripts/workspace-rag/deploy.sh
/home/ubuntu/scripts/workspace-rag/ecosystem.config.js
```

It also symlinks app env files to the config directory, matching the existing `proctorpal` and `interviewcoach` pattern.

## One-Time Server Prep

Install pgvector, create swap, and activate pnpm:

```bash
bash deploy/ec2/scripts/setup-prereqs.sh
```

Create a database password locally:

```bash
openssl rand -base64 32
```

Create the isolated DB and enable pgvector:

```bash
DB_PASSWORD="replace-with-db-password" pnpm ec2:setup-db
```

Run the host check any time:

```bash
pnpm ec2:check
```

Edit both config files and replace placeholders. The app needs a real domain with HTTPS for production cookies.

## Build, Migrate, Seed

```bash
/home/ubuntu/scripts/workspace-rag/deploy.sh
```

The deploy script pulls `main`, installs dependencies, runs migrations, seeds reviewer data, builds, starts/reloads PM2, and performs local health checks.

## PM2 Manual Commands

```bash
export PATH=/home/ubuntu/.nvm/versions/node/v22.22.3/bin:$PATH
pm2 start /home/ubuntu/scripts/workspace-rag/ecosystem.config.js
pm2 save
pm2 list
```

## Nginx

Use a dedicated domain such as `workspace-rag.example.com`; do not reuse the existing app domains.

```bash
APP_DOMAIN=workspace-rag.example.com pnpm ec2:nginx
```

Enable HTTPS:

```bash
APP_DOMAIN=workspace-rag.example.com ENABLE_CERTBOT=1 pnpm ec2:nginx
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
