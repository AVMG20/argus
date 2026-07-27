---
name: nuxt-ui-workflow
description: Build and maintain the Argus Nuxt 4 interface with Nuxt UI. Use when changing pages, layouts, Vue components, navigation, forms, or visual behavior in this repository.
---

# Nuxt UI workflow

- Keep application pages and components under `app/`; use Nuxt UI components before introducing custom primitives.
- Preserve the app shell in `app/app.vue`: the sidebar owns team switching and the profile control, while the home page stays intentionally empty until product work adds content.
- Put reusable client authentication calls in `app/lib/auth-client.ts` rather than duplicating client setup.
- Verify UI work with `bun run typecheck`, then run the app and inspect the affected responsive states.
