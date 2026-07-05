# Deployment

Use Node.js 22 and pnpm 11.x for hosted builds. The repository root must stay available to both hosted apps because `apps/api` and `apps/web` depend on `packages/shared`.

## Database
Use Neon Free Postgres.

1. Create a project.
2. Copy a direct Postgres connection string from the Neon Connect dialog with SSL enabled.
3. Run migrations and seed from a trusted shell:

```bash
DATABASE_URL="postgresql://..." pnpm db:deploy
DATABASE_URL="postgresql://..." pnpm db:seed
```

The first migration enables `vector`; no manual SQL is needed unless the migration fails before creating the extension.

## API on Render
- Root directory: repository root.
- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace-rag/api build`
- Start command: `pnpm --filter @workspace-rag/api start`
- Health check path: `/health`
- Required env vars:
  - `DATABASE_URL`: Neon connection string.
  - `JWT_SECRET`: generated secret, at least 24 characters.
  - `COOKIE_SECRET`: generated secret, at least 24 characters.
  - `GEMINI_API_KEY`: restricted Gemini API key.
  - `AI_PROVIDER`: `gemini`
  - `GEMINI_CHAT_MODEL`: `gemini-3.5-flash`
  - `GEMINI_EMBEDDING_MODEL`: `gemini-embedding-2`
  - `GEMINI_EMBEDDING_DIMENSIONS`: `1536`
  - `WEB_ORIGIN`: final Vercel production URL.
  - `API_ORIGIN`: final Render URL.
  - `MAX_UPLOAD_BYTES`: `5242880`

Generate secrets locally:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

## Web on Vercel
- Framework preset: Next.js.
- Root directory: `apps/web`.
- Set `API_INTERNAL_ORIGIN` to the Render API URL.
- Set `NEXT_PUBLIC_APP_NAME=Workspace RAG Assistant`.
- Build command: keep Vercel's detected Next.js command, or set `pnpm build` if detection does not pick it up.

The frontend calls `/api/*`; Next.js rewrites those requests to the backend.

## Smoke Test
After both deployments are live:

```bash
curl https://your-render-service.onrender.com/health
```

Then open the Vercel URL and run the reviewer flow from `README.md`: sign in, upload the two sample documents into different workspaces, verify scoped citations, and trigger `save_task`.
