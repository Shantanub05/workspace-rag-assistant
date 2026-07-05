# Workspace RAG Assistant

Multi-workspace document assistant with sign-in, document ingestion, workspace-scoped RAG, citations, model-selected tool calling, and a dashboard for documents, chat history, tasks, and tool-call logs.

The critical requirement is tenant isolation inside one shared vector store. All chunks live in `document_chunks`; retrieval filters by `workspace_id` inside the vector query before ordering by vector distance.

## Stack
- Frontend: Next.js App Router, Tailwind, shadcn-style primitives, Motion, lucide-react.
- Backend: NestJS, Prisma, Postgres, pgvector.
- AI provider: Gemini adapter for chat/tool calling and embeddings.
- Data: Neon Postgres in production, local pgvector Postgres through Docker.
- Deployment target: Vercel Hobby for web, Render Free Web Service for API, Neon Free Postgres.

## Local Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`.

Seeded reviewer login:

```text
Email: reviewer@example.com
Password: WorkspaceRag!2026
```

For real LLM responses and embeddings, set `GEMINI_API_KEY` in `apps/api/.env` or root `.env` before starting the API. Without it, the API intentionally fails Gemini calls instead of silently using paid or hidden services.

## Environment Variables

Copy `.env.example` and fill:

- `DATABASE_URL`: Postgres connection string with pgvector enabled.
- `JWT_SECRET`: long random string for access tokens.
- `COOKIE_SECRET`: long random string for signed cookies.
- `GEMINI_API_KEY`: Google AI Studio key.
- `GEMINI_CHAT_MODEL`: default `gemini-3.5-flash`.
- `GEMINI_EMBEDDING_MODEL`: default `gemini-embedding-2`.
- `WEB_ORIGIN`: browser origin allowed by the API.
- `API_INTERNAL_ORIGIN`: API origin used by the Next.js rewrite.

Do not commit real `.env` files or provider keys.

## Reviewer Test Flow

1. Sign in with the reviewer account.
2. Use the workspace switcher to open `Atlas Research`.
3. Upload `samples/atlas-research.md`.
4. Ask: `What is the Atlas launch code and who owns rollout?`
5. Confirm the answer cites the Atlas document.
6. Switch to `Beacon Ops`.
7. Upload `samples/beacon-ops.md`.
8. Ask the Atlas launch-code question again. The assistant should say it does not know.
9. Ask: `Save a task to review the deployment checklist tomorrow.`
10. Confirm a task appears and a `save_task` tool call is logged.

## Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

`pnpm e2e` expects the app and API to be running.

## Deployment Notes

1. Create a Neon free Postgres project and enable `vector`.
2. Set `DATABASE_URL` in Render and run `pnpm db:deploy && pnpm db:seed`.
3. Deploy `apps/api` to Render as a Node web service from the repository root with build command `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace-rag/api build` and start command `pnpm --filter @workspace-rag/api start`.
4. Deploy `apps/web` to Vercel with `API_INTERNAL_ORIGIN` set to the Render API URL.
5. Set `WEB_ORIGIN` on Render to the Vercel URL.

The deployed URL and final repo URL should be added here after deployment:

- Repository: `https://github.com/Shantanub05/workspace-rag-assistant`
- Web URL: pending deployment
- API URL: pending deployment

## AI Context Files

This repo includes the exact `AGENTS.md` instruction file used while building the project and `AI_NOTES.md` for the required AI collaboration notes.
