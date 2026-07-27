---
name: drizzle-workflow
description: Maintain the Argus PostgreSQL schema and Drizzle migrations. Use when adding or modifying persisted data, queries, indexes, or database migration workflows in this repository.
---

# Drizzle workflow

- Treat `server/db/schema.ts` as generated Better Auth schema. Regenerate it with `bun run auth:generate` after changing Better Auth plugins; do not hand-edit its auth tables.
- Put application tables in a separate schema file and export them through the Drizzle client when they are needed.
- Run `bun run db:generate` after schema changes, review the generated SQL in `drizzle/`, then run `bun run db:migrate` against the local Docker database.
- Use `DATABASE_URL` from `.env`; the local PostgreSQL service listens on port `55329`.
