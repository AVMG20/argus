<div align="center">

<img src="public/argus-logo.png" alt="" width="72">

# Argus

**Self-hosted error and performance tracking. The small alternative to Sentry.**

[Website](https://avmg20.github.io/argus/) · [Quick start](#quick-start) · [Configuration](#configuration) · [Development](#development)

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

Argus receives events from the official Sentry SDKs, groups repeated exceptions
into issues, and shows you the stack trace, breadcrumbs, tags, request and user
data, and runtime context behind each one. It also stores performance
transactions and their spans, so you can see which endpoints got slow and where
the time went.

It is one Nuxt server and one Postgres database. No Kafka, no Clickhouse, no
telemetry, no quota.

## Quick start

```sh
git clone https://github.com/AVMG20/argus.git
cd argus
docker compose up -d
```

That builds the app, starts Postgres, applies the schema and serves Argus on
<http://localhost:3000>. Create an account, create a team, create a project, and
the project's setup page gives you a DSN and a copy-pasteable snippet for your
platform.

For a public deployment there is one value to set — `.env.example` is written
for exactly that:

```sh
cp .env.example .env   # set BETTER_AUTH_URL to the URL people will use
docker compose up -d
```

`BETTER_AUTH_URL` has to match the URL in the browser, including `https` and any
port, because session cookies and invitation links are built from it.

Upgrading is `git pull && docker compose up -d --build`; the schema is applied on
every start.

> [!NOTE]
> Argus has no email provider, so accounts are treated as verified on creation
> and team invitations are links you copy and share yourself.

## Sending events

Point any official Sentry SDK at your project's DSN — that is the only change to
your application:

```js
import * as Sentry from '@sentry/browser'

Sentry.init({
  dsn: 'http://PUBLIC_KEY@argus.example.com/sentry/1',
  environment: 'production',
  release: 'storefront@2.8.0',
  tracesSampleRate: 0.2 // omit to send errors only
})
```

Argus implements the Sentry envelope endpoint (`POST /sentry/:projectId/envelope`)
and accepts both `event` and `transaction` items, so breadcrumbs, contexts,
releases, tags and spans all arrive unchanged.

There is also a plain JSON endpoint for anything that is not a Sentry SDK:

```sh
curl -X POST http://localhost:3000/api/store/PUBLIC_KEY \
  -H 'content-type: application/json' \
  -d '{
    "message": "Checkout failed",
    "exception": {
      "type": "TypeError",
      "value": "Cannot read properties of undefined",
      "stacktrace": [{
        "filename": "app/checkout.ts",
        "function": "submitOrder",
        "lineno": 42,
        "inApp": true
      }]
    },
    "environment": "production",
    "release": "web@1.4.0",
    "tags": { "region": "eu-west" },
    "user": { "id": "usr_123" }
  }'
```

Repeated events group by exception type, message and top in-app frame, unless the
payload supplies its own `fingerprint` array.

Cookies, authorization headers, tokens and passwords are redacted during
ingestion — before anything reaches the database.

## Configuration

Every setting is an environment variable, and every one has a working default.

| Variable | Default | What it does |
| --- | --- | --- |
| `BETTER_AUTH_URL` | `http://localhost:3000` | The URL people open in their browser. Session cookies and invitation links are built from it. |
| `DATABASE_URL` | the bundled Postgres | Connection string for the database. Set it to run against a Postgres you already have; the bundled one then goes unused. |
| `BETTER_AUTH_SECRET` | generated | Signs session cookies. Under Compose one is generated on first start and kept in the `argus_data` volume. Required in production if you run the app yourself. |
| `ARGUS_PORT` | `3000` | Host port Compose publishes the app on. |
| `PORT` | `3000` | Port the server itself listens on. |

The bundled Postgres uses credentials internal to the Compose project and
publishes its port on `127.0.0.1:55329` — reachable from the host for
`bun run dev` and drizzle-kit, and from nowhere else.

Performance transactions are capped at 100,000 per project; older ones and their
spans are removed as new ones arrive, so tracing cannot fill the disk unbounded.
Errors are kept until you delete them.

## Development

Argus runs on [Bun](https://bun.sh).

```sh
docker compose up -d postgres   # just the database
bun install
bun run db:push                 # apply the schema
bun run dev                     # http://localhost:3000
```

| Command | Purpose |
| --- | --- |
| `bun run dev` | Development server with HMR |
| `bun run build` / `bun run preview` | Production build and preview |
| `bun run lint` | ESLint (`--fix` to apply) |
| `bun run typecheck` | `vue-tsc` over the whole project |
| `bun run db:push` | Push `server/db/schema.ts` to the database |
| `bun run auth:generate` | Regenerate the Better Auth tables in the schema |

Lint and typecheck both run in CI and must pass.

### Layout

```
app/            Nuxt 4 frontend — pages, components, middleware
server/api/     Internal JSON API used by the app
server/routes/  Sentry-compatible ingestion endpoints
server/lib/     Ingestion, analytics, auth and access control
server/db/      Drizzle schema and client
index.html      The marketing site, served by GitHub Pages
```

`CLAUDE.md` describes the architecture and conventions in more detail — useful
for people as well as coding agents.

## Contributing

Issues and pull requests are welcome at
<https://github.com/AVMG20/argus>. Please run `bun run lint` and
`bun run typecheck` before opening a PR, and keep changes focused — Argus stays
deliberately small.

Not on the roadmap: session replay, profiling, cron monitoring, alert routing.
If you need those, Sentry does them well.

## License

MIT — see [LICENSE](LICENSE).
