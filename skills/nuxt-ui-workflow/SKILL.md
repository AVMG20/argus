---
name: nuxt-ui-workflow
description: Build and maintain the Argus Nuxt 4 interface with Nuxt UI. Use when changing pages, layouts, Vue components, navigation, forms, or visual behavior in this repository.
---

# Nuxt UI workflow

- Keep application pages and components under `app/`; use Nuxt UI components before introducing custom primitives. `AppPanel`, `DataList`, `AppRangeTabs`, `AppVolumeChart` and `CopyButton` are the local building blocks.
- `app/app.vue` wraps every route except `/sign-in` in the dashboard shell; the sidebar owns team switching and the profile control. `/` is the project list — there is no `/dashboard` route.
- Every route is authenticated. `app/middleware/auth.global.ts` allowlists the public ones, so a new page is protected by default; it has a server branch and a client branch that must stay in step.
- Put reusable client authentication calls in `app/lib/auth-client.ts`, and shared payload shapes in `app/lib/types.ts`, rather than re-typing them per page.
- Use semantic colour and surface classes (`text-muted`, `bg-elevated`, `border-default`, `text-error`) — the accent and neutral are user-configurable at runtime, so raw palette values break theming. Any class that must survive the build has to appear as a literal string.
- Import chart libraries with `defineAsyncComponent(() => import('vue-chrts')...)` so the barrel never loads during SSR.
- Verify UI work with `bun run lint` and `bun run typecheck`, then run the app and inspect the affected responsive states.
- The marketing page is `index.html` at the repo root, served by GitHub Pages. It is plain hand-written HTML and CSS with no Nuxt or Tailwind involved; keep its feature claims in step with what the app does.
