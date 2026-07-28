# CLAUDE.md

Guidance for Claude Code and other agents working in this repository.

## What Argus is

A self-hosted error and performance tracker — a small alternative to Sentry.
It accepts events from the official Sentry SDKs, groups exceptions into issues,
and stores performance transactions with their spans. One Nuxt server, one
Postgres database, nothing else.

The scope is deliberately narrow. Session replay, profiling, cron monitoring,
alert routing, email delivery and telemetry are **not** part of Argus; do not add
them without the maintainer asking. When a feature can be done in Postgres and
the existing app, do it there rather than introducing a service.

## Stack

Nuxt 4 (Vue 3, SSR) · Nuxt UI 4 · Tailwind 4 · Nitro on Bun · Drizzle ORM ·
Postgres · Better Auth · Unovis / vue-chrts for charts.

**Bun, not npm.** Every script goes through `bun --bun`.

```sh
bun run dev         # dev server on :3000
bun run lint        # ESLint — must pass, runs in CI
bun run typecheck   # vue-tsc — must pass, runs in CI
bun run build       # production build
bun run db:push     # push server/db/schema.ts to Postgres
bun run auth:generate  # regenerate the Better Auth tables in the schema
```

Postgres for development comes from `docker compose up -d postgres` and listens on
**port 55329**. `docker compose up -d` brings up the whole stack instead.

Verify changes with `bun run lint && bun run typecheck` before reporting done.
There is no test suite; UI work needs the app run and looked at.

## Layout

```
app/
  pages/            File-based routes. index.vue is the project list (the app root)
  components/       Shared UI; issue/ holds the issue-detail panels
  composables/      useAppearance — client-only theme preferences
  middleware/       auth.global.ts — the single gate on every route
  lib/              auth-client.ts (Better Auth browser client) and types.ts
                    (shared payload shapes); both imported explicitly
  utils/            format.ts (dates, counts, durations), sentry.ts (payload types)
server/
  routes/sentry/    Sentry-compatible ingestion — the public surface
  api/store/        Plain-JSON ingestion for non-SDK clients
  api/              Internal JSON API the app itself calls
  lib/              ingest, ingest-performance, analytics, auth, access
  db/               Drizzle schema and client
  plugins/          Nitro startup hooks
index.html          Static marketing site for GitHub Pages — not part of the app
```

## Routing and auth

Argus is an authenticated tool with no public pages. `app/middleware/auth.global.ts`
holds an **allowlist** (`publicRoutes`, currently just `/sign-in`); everything else
requires a session, so a new page is protected by default. Unauthenticated
visitors are sent to `/sign-in?redirect=<path>` and land on their original
destination after signing in.

- `/` is the project list. There is no `/dashboard` route — links to the app root
  are plain `/`.
- The middleware also handles onboarding: a signed-in user with no organization
  goes to `/onboarding`, and someone who already has one is bounced off it —
  unless they arrived with an `?invite=` parameter.
- It runs on both server and client, with the two branches doing the same thing
  through different clients (`useRequestFetch` vs `authClient`). Change both.
- `app/app.vue` wraps every route except `/sign-in` in the dashboard shell
  (`UDashboardGroup` + `AppSidebar`). Sign-in renders its own full-page layout.

Authorization is enforced server-side, never by hiding UI. Every handler that
touches project data calls `requireOrganizationMember(event, organizationId)`, or
`requireOrganizationRole(...)` for destructive and administrative actions, from
`server/lib/access.ts`.

Better Auth is configured once in `server/lib/auth.ts` and mounted only through
`server/api/auth/[...all].ts`. **This instance has no email provider**: accounts
are marked verified on creation and invitations are database rows that produce a
link to share manually. Do not add `sendInvitationEmail` or an SMTP dependency.
After changing Better Auth plugin options, run `bun run auth:generate` and then
`bun run db:push`.

## Ingestion

Two entry points, both public and both unauthenticated by design — a project's
`publicKey` is the credential:

- `POST /sentry/:projectId/envelope` — the Sentry envelope protocol. Resolves the
  project by `sentryProjectId` **and** `publicKey` (from the envelope DSN, the
  `sentry_key` query parameter, or the `x-sentry-auth` header), then dispatches
  each item: `event` → `ingestEvent`, `transaction` → `ingestTransaction`.
- `POST /api/store/:publicKey` — a plain JSON error payload for clients that are
  not a Sentry SDK.

Both respond `202` and set permissive CORS headers; browsers post to them
directly.

Rules that live in `server/lib/ingest.ts` and must not regress:

- **Sanitize first.** `sanitizeValue()` runs over the whole payload before
  anything is written: cookies are reduced to their names, and anything matching
  authorization / token / password / secret / api-key / session becomes
  `[Filtered]`. New payload fields inherit this automatically — keep it that way.
- **Grouping.** The fingerprint is the payload's own `fingerprint` array joined
  with `:`, or else a hash of exception type, title and the top in-app frame.
  Matching events increment `eventCount`, bump `lastSeen` and reopen a resolved
  issue.
- **Both casings.** SDKs send `in_app`/`inApp`, `context_line`/`contextLine`,
  epoch seconds or ISO timestamps. Normalize on the way in; the UI reads the
  normalized shape and the untouched payload stays in `rawPayload`.

`server/lib/ingest-performance.ts` stores a transaction plus up to 250 spans, and
then deletes everything past the newest 1,000,000 transactions for that project
(spans follow via cascade). Keep storage bounded when adding anything
high-volume.

## Data model

`server/db/schema.ts` holds two kinds of table in one file:

- **Generated by Better Auth** — `user`, `session`, `account`, `verification`,
  `organization`, `team`, `teamMember`, `member`, `invitation`. Do not hand-edit
  these; regenerate with `bun run auth:generate`.
- **Application tables** — `project`, `issue`, `errorEvent`,
  `performanceTransaction`, `performanceSpan`. Edit these directly, then
  `bun run db:push`.

The workflow is push-based; there are no checked-in SQL migrations, and the
Docker entrypoint pushes the schema on every container start.

A `project` belongs to an `organization`, and carries the `publicKey` and
numeric `sentryProjectId` that form its DSN.

## Server queries

The API returns page-shaped payloads: `server/api/projects/[id].get.ts` answers
one request with issues, facets, stats and chart series. Prefer widening an
existing endpoint over adding a chatty new one.

Aggregation is Postgres' job, not JavaScript's — `count(*) filter (where ...)`,
`percentile_cont`, `array_agg ... filter`, `jsonb_each_text`. `server/lib/analytics.ts`
holds the shared series and distribution queries. Time buckets are always
computed **relative to `now()` inside Postgres** so a series never depends on how
the process and the database resolve time zones.

## Frontend conventions

- Reach for a Nuxt UI component before writing a primitive. Pages are built from
  `UDashboardPanel` / `UDashboardNavbar`, with `AppPanel`, `DataList`,
  `AppRangeTabs`, `AppVolumeChart` and `CopyButton` as the local building blocks.
- Semantic color and surface classes only — `text-muted`, `text-dimmed`,
  `bg-elevated`, `border-default`, `text-error`. No raw palette values; the accent
  and neutral are user-configurable at runtime.
- Chart libraries are heavy and browser-only: import them with
  `defineAsyncComponent(() => import('vue-chrts')...)` as `AppVolumeChart` does,
  so the barrel never loads during SSR.
- Any Tailwind class that must survive the build has to appear as a literal
  string — see the static `class` values in `useAppearance.ts`.
- Page data comes from `useFetch` for the initial render; mutations use `$fetch`
  followed by `refresh()`.
- Keyboard shortcuts go through `defineShortcuts` (the issue list already binds
  `j`/`k`/`x`/`e`).
- `any` is a lint error. Shapes shared between pages — organizations, members,
  invitations, project rows — live in `app/lib/types.ts`, deliberately narrower
  than the server types they are assigned from.

## Style

ESLint enforces the house style: **no trailing commas**, 1TBS braces, single
quotes. Run `bun run lint --fix` rather than reformatting by hand.

Comments explain *why*, never *what*, and only where the reason is not obvious
from the code — the existing comments about Node's heap in the Dockerfile, the
missing email provider, and SSR-safe chart imports are the model. Match that
density; do not narrate.

## Docker

`docker compose up -d` builds the app, starts Postgres, waits for its healthcheck,
pushes the schema and serves on :3000. The build runs Nuxt under **Node** with a
pinned heap even though the output runs on Bun — Bun's bundler balloons and gets
killed here; leave that as it is.

`docker-entrypoint.sh` generates and persists a `BETTER_AUTH_SECRET` in the
`argus_data` volume when none is supplied, so a fresh clone comes up with a real
secret and restarts do not sign everyone out.

The runtime image installs drizzle-kit separately, with versions pinned in the
Dockerfile. If those versions change in `package.json`, change them there too.

## The marketing site

`index.html` at the repo root is a hand-written, dependency-free static page
served by GitHub Pages (source: `main` branch, `/` root). It is **not** built by
Nuxt and shares nothing with the app — no Tailwind, no components, inline CSS
only, and it must stay self-contained. It links to
`public/argus-logo.png` with relative paths so it works from the
`/argus/` subpath.

Feature claims on that page must match what the app actually does. When shipping
or removing a user-visible feature, update the feature grid, comparison table and
FAQ in the same change.
