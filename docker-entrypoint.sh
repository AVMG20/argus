#!/bin/sh
set -e

# No secret supplied: mint one and keep it in the data volume. Regenerating it
# on every boot would sign everyone out on every restart, so it is written once.
if [ -z "$BETTER_AUTH_SECRET" ]; then
  secret_file=/app/data/auth-secret
  mkdir -p /app/data
  if [ ! -f "$secret_file" ]; then
    bun -e 'console.log([...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join(""))' > "$secret_file"
    chmod 600 "$secret_file"
    echo "[argus] Generated an authentication secret in the data volume."
  fi
  BETTER_AUTH_SECRET="$(cat "$secret_file")"
  export BETTER_AUTH_SECRET
fi

# Argus keeps its schema in server/db/schema.ts and pushes it straight to
# Postgres — there is no separate migration step to run or forget. Pushing on
# every start makes an upgrade `docker compose pull && docker compose up -d`.
echo "[argus] Applying database schema..."
bunx drizzle-kit push --force

echo "[argus] Listening on port ${PORT:-3000}"
exec "$@"
