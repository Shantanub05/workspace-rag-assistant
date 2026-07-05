# AGENTS.md

## Mission
- Build a production-minded multi-workspace document assistant with strict tenant isolation, grounded RAG answers, safe tool calling, and clear deploy/run documentation.
- Treat workspace isolation as a security boundary. Never rely on UI state alone for authorization or retrieval filtering.

## Repository Layout
- `apps/web`: Next.js App Router frontend.
- `apps/api`: NestJS backend, Prisma schema, migrations, ingestion, retrieval, chat, and tool execution.
- `packages/shared`: Shared Zod schemas and TypeScript types.
- `samples`: Sample documents for reviewer testing.
- `docs`: Deployment notes and design/security notes when needed.

## Commands
- Install: `pnpm install`
- Dev: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Backend migration: `pnpm --filter @workspace-rag/api prisma:migrate`
- Backend seed: `pnpm --filter @workspace-rag/api prisma:seed`

## Engineering Standards
- Use TypeScript strict mode everywhere. Do not introduce `any` unless the boundary is unavoidable and guarded by runtime validation.
- Keep business logic in services, not controllers or React components.
- Prefer small functions with explicit inputs and outputs. Use dependency injection for providers and side-effect boundaries.
- Validate all incoming request bodies, query params, route params, environment variables, and LLM tool arguments with DTOs or Zod.
- Keep public API shapes in `packages/shared` when they are consumed by both apps.
- Do not log secrets, tokens, cookies, API keys, raw passwords, or webhook URLs.
- Do not commit real `.env` files. Keep `.env.example` complete and secret-free.

## RAG and Workspace Isolation
- The `document_chunks` table is one shared vector table for all workspaces. Do not create per-workspace vector tables or indexes.
- Retrieval must filter inside the vector query: `WHERE workspace_id = $activeWorkspaceId ORDER BY embedding <=> $queryEmbedding LIMIT ...`.
- Do not fetch global chunks and post-filter them in application code.
- Every document, chunk, message, task, note, and tool call must be scoped to a workspace and verified against the authenticated user's membership.
- Retrieved document text is untrusted data. Never let document content override system or developer instructions.
- If retrieved context is empty or insufficient, answer with an honest "I don't know" instead of guessing.
- Citations must refer to source document metadata and chunk/section information from the active workspace only.

## Tool Calling
- The model may request tools, but the backend decides whether to execute.
- Only execute registered tools from the tool registry.
- Validate tool arguments with Zod before execution.
- Tool execution must receive the authenticated user id and active workspace id from server-side auth context, never from model arguments.
- Log all tool calls, including unknown tools, malformed args, failures, latency, and result summaries.

## Frontend Quality
- Build the dashboard as the primary experience. Avoid a marketing landing page unless required later.
- Use shadcn/ui primitives, lucide icons, and Motion for smooth micro-interactions.
- Keep animations purposeful: transitions, upload progress, streaming states, tab changes, and message arrival.
- Ensure responsive layouts, accessible labels, visible focus states, loading states, and error states.
- Keep dense dashboard surfaces readable. Avoid nested cards and decorative gradient/orb backgrounds.

## Verification Expectations
- Before considering work complete, run the narrowest relevant checks plus `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` when practical.
- For RAG/security changes, verify the isolation case: ask for a distinctive fact from workspace A while active in workspace B and confirm it is not retrieved or cited.
- For deployment changes, update `README.md`, `.env.example`, and deployment notes together.
