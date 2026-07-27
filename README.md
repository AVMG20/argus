# Argus

Argus is a focused, self-hosted JavaScript error monitor. Teams create projects,
send error events to a project-specific endpoint, and investigate grouped issues,
stack traces, breadcrumbs, tags, request data, user data, and runtime context.

## Setup

```sh
bun install
bun run db:push
bun run dev
```

The default local database URL is
`postgresql://argus:argus@localhost:55329/argus`. Override it with
`DATABASE_URL`. Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` outside local
development.

## Event ingestion

Every project exposes `POST /api/store/:publicKey`. A minimal event:

```json
{
  "message": "Checkout failed",
  "exception": {
    "type": "TypeError",
    "value": "Cannot read properties of undefined",
    "stacktrace": [
      {
        "filename": "app/checkout.ts",
        "function": "submitOrder",
        "lineno": 42,
        "colno": 18,
        "inApp": true,
        "contextLine": "return cart.customer.id"
      }
    ]
  },
  "environment": "production",
  "release": "web@1.4.0",
  "tags": { "browser": "Chrome", "region": "eu-west" },
  "user": { "id": "usr_123" }
}
```

Repeated events are grouped by exception type, message, and top frame unless
the payload supplies an explicit `fingerprint` array.
