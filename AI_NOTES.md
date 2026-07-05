# AI Notes

## Tools Used
- Codex was used for planning, source inspection, implementation, and verification.
- Web research was used for Codex `AGENTS.md` guidance, Next.js/NestJS conventions, Gemini free-tier/tool-calling/embedding support, Neon pgvector support, and OWASP API security priorities.

## Key Decisions
- Workspace isolation is enforced by backend authorization checks and by filtering `workspace_id` inside the vector SQL query, not by UI state or post-filtering.
- The vector store is a single Postgres `document_chunks` table using pgvector with `workspace_id` metadata, matching the assignment's shared-store requirement.
- Tool calls are model-proposed but server-disposed: only registered tools execute, and every argument payload is validated with Zod before any side effect.
- Gemini is the implemented provider because the assignment requires a no-card/free LLM and embedding option. The code still uses an adapter boundary so another provider can be added later.

## Hardest AI Wrong Turn
The riskiest path was treating "multi-workspace" as a frontend switcher problem. The corrected design treats it as a backend security boundary: every workspace-scoped service accepts authenticated user context, verifies membership, and uses `workspace_id` directly in database reads and writes.

## More Time
- Add hybrid search with `tsvector` plus vector scoring.
- Add cross-workspace document sharing with explicit ACL rows.
- Add richer token/cost dashboards and OpenTelemetry export.
- Add background ingestion jobs for larger PDFs.
