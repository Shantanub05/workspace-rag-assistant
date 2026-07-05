# Deployment

## Database
Use Neon Free Postgres.

1. Create a project.
2. Run `CREATE EXTENSION IF NOT EXISTS vector;` if migrations have not already enabled it.
3. Set `DATABASE_URL` in Render.
4. Run migrations with `pnpm --filter @workspace-rag/api prisma:deploy`.

## API on Render
- Root directory: repository root.
- Build command: `pnpm install --frozen-lockfile && pnpm --filter @workspace-rag/api prisma:generate && pnpm --filter @workspace-rag/api build`
- Start command: `pnpm --filter @workspace-rag/api start`
- Required env vars: `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `GEMINI_API_KEY`, `WEB_ORIGIN`, `API_ORIGIN`.

## Web on Vercel
- Framework preset: Next.js.
- Root directory: `apps/web`.
- Set `API_INTERNAL_ORIGIN` to the Render API URL.
- Set `NEXT_PUBLIC_APP_NAME=Workspace RAG Assistant`.

The frontend calls `/api/*`; Next.js rewrites those requests to the backend.
