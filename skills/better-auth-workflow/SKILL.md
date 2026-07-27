---
name: better-auth-workflow
description: Maintain Argus authentication, organizations, teams, and local invitations with Better Auth. Use when changing sign-in, sessions, organization switching, team membership, invitations, or authorization in this repository.
---

# Better Auth workflow

- Keep the server authority in `server/lib/auth.ts` and mount it only through `server/api/auth/[...all].ts`.
- Use the Drizzle adapter and the organization plugin with teams enabled. After changing plugin options, run `bun run auth:generate` followed by `bun run db:generate`.
- Use `organizationClient({ teams: { enabled: true } })` in browser code so organization and team client endpoints remain typed.
- Invitations are intentionally database-only: do not configure `sendInvitationEmail` or introduce an email provider unless the product requirement changes.
- Enforce server-side authorization through Better Auth endpoints; never rely on sidebar visibility as an access-control check.
