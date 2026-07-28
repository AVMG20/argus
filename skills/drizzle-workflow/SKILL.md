---
name: drizzle-workflow
description: Maintain the Argus PostgreSQL schema and Drizzle queries. Use when adding or modifying persisted data, queries, indexes, or the database workflow in this repository.
---

# Drizzle workflow

- `server/db/schema.ts` holds both kinds of table. The Better Auth tables (`user`, `session`, `account`, `verification`, `organization`, `team`, `teamMember`, `member`, `invitation`) are generated — regenerate with `bun run auth:generate` and never hand-edit them. The application tables (`project`, `issue`, `errorEvent`, `performanceTransaction`, `performanceSpan`) are edited directly. ESLint ignores this file because the generator owns its formatting.
- The workflow is push-based: change the schema, then `bun run db:push`. There are no checked-in SQL migrations, and the Docker entrypoint pushes on every container start.
- Use `DATABASE_URL` from `.env`; the local PostgreSQL service listens on port `55329` (`docker compose up -d postgres`).
- Aggregate in Postgres, not in JavaScript: `count(*) filter (where ...)`, `percentile_cont`, `array_agg ... filter`, `jsonb_each_text`. Shared series and distribution queries belong in `server/lib/analytics.ts`.
- Compute time buckets relative to `now()` inside the query so a series never depends on how the process and the database resolve time zones.
- Anything ingested at event volume needs a retention bound — see the per-project transaction cap in `server/lib/ingest-performance.ts`.
