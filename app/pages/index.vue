<script setup lang="ts">
import { authClient } from '../lib/auth-client'

const { links } = useAppConfig()
const session = authClient.useSession()
const isSignedIn = computed(() => Boolean(session.value.data?.user))

useSeoMeta({
  title: 'Argus — open source, self-hosted error tracking',
  description: 'Argus is a free and open source alternative to Sentry. Point the Sentry SDK you already use at your own server and keep every error event in your own Postgres.',
  ogTitle: 'Argus — open source, self-hosted error tracking',
  ogDescription: 'The small, self-hosted alternative to Sentry. MIT licensed, Sentry SDK compatible, one app and one Postgres.'
})

const features = [
  {
    icon: 'i-lucide-layers-3',
    title: 'Grouped into issues',
    text: 'Repeated exceptions collapse into one issue, fingerprinted by type, message, and the first in-app frame. Send your own fingerprint when you want different grouping.'
  },
  {
    icon: 'i-lucide-code-2',
    title: 'Real stack traces',
    text: 'Full exception chains, in-app frames highlighted, surrounding source lines and frame variables when the SDK sends them.'
  },
  {
    icon: 'i-lucide-footprints',
    title: 'Everything around the error',
    text: 'Breadcrumbs on a timeline, tags, request and user data, browser, OS, device and runtime contexts — plus the raw payload if you want to see it untouched.'
  },
  {
    icon: 'i-lucide-list-filter',
    title: 'Triage that keeps up',
    text: 'Search, filter by status, level, environment and release, sort by events, users or trend, select in bulk and resolve. j/k/x/e shortcuts, no mouse required.'
  },
  {
    icon: 'i-lucide-activity',
    title: 'Trends and distributions',
    text: '24-hour and 30-day event charts per issue, affected user counts, and a breakdown of which browsers, releases, URLs, users, and custom tags are hit.'
  },
  {
    icon: 'i-lucide-shield-check',
    title: 'Secrets filtered on the way in',
    text: 'Cookies, authorization headers, tokens and passwords are redacted during ingestion, before anything is written to your database.'
  },
  {
    icon: 'i-lucide-users-round',
    title: 'Teams and projects',
    text: 'Organizations with invitations and roles. Every project belongs to a team, and issues stay scoped to it.'
  },
  {
    icon: 'i-lucide-database',
    title: 'One app, one database',
    text: 'A Nuxt server and Postgres. No Kafka, no Clickhouse, no message brokers, nothing calling home.'
  }
]

const sdks = [
  { label: 'JavaScript', icon: 'i-simple-icons-javascript' },
  { label: 'React', icon: 'i-simple-icons-react' },
  { label: 'Vue', icon: 'i-simple-icons-vuedotjs' },
  { label: 'Nuxt', icon: 'i-simple-icons-nuxtdotjs' },
  { label: 'Next.js', icon: 'i-simple-icons-nextdotjs' },
  { label: 'Svelte', icon: 'i-simple-icons-svelte' },
  { label: 'Angular', icon: 'i-simple-icons-angular' },
  { label: 'Node.js', icon: 'i-simple-icons-nodedotjs' },
  { label: 'PHP', icon: 'i-simple-icons-php' },
  { label: 'Laravel', icon: 'i-simple-icons-laravel' },
  { label: 'Symfony', icon: 'i-simple-icons-symfony' },
  { label: 'Python', icon: 'i-simple-icons-python' },
  { label: 'Django', icon: 'i-simple-icons-django' },
  { label: 'Flask', icon: 'i-simple-icons-flask' },
  { label: 'Ruby', icon: 'i-simple-icons-ruby' },
  { label: 'Rails', icon: 'i-simple-icons-rubyonrails' },
  { label: 'Go', icon: 'i-simple-icons-go' },
  { label: '.NET', icon: 'i-simple-icons-dotnet' }
]

const comparison = [
  { feature: 'License', argus: 'MIT, free forever', sentry: 'Paid SaaS, BUSL source' },
  { feature: 'What you run', argus: 'Nuxt app + Postgres', sentry: '20+ services to self-host' },
  { feature: 'Where events live', argus: 'Your database', sentry: 'Their cloud, or your cluster' },
  { feature: 'Event quota', argus: 'Your disk', sentry: 'Per-plan quota and overage' },
  { feature: 'SDKs', argus: 'The official Sentry SDKs', sentry: 'The official Sentry SDKs' },
  { feature: 'Error tracking', argus: 'yes', sentry: 'yes' },
  { feature: 'Performance tracing', argus: 'planned', sentry: 'yes' },
  { feature: 'Session replay, profiling, crons', argus: 'no', sentry: 'yes' }
]

const quickstart = [
  {
    title: 'Run it',
    text: 'Postgres and the app. That is the whole stack.',
    code: `git clone ${links.github}.git
docker compose up -d
bun install && bun run db:push && bun run dev`
  },
  {
    title: 'Create a project',
    text: 'Sign up on your own instance, create a team, and copy the project DSN.',
    code: `http://PUBLIC_KEY@localhost:3000/sentry/1`
  },
  {
    title: 'Point your SDK at it',
    text: 'The one line that changes. Everything else about your setup stays the same.',
    code: `import * as Sentry from '@sentry/browser'

Sentry.init({
  dsn: 'http://PUBLIC_KEY@errors.example.com/sentry/1',
  environment: 'production'
})`
  }
]

const faq = [
  {
    label: 'Is it actually free?',
    content: 'Yes. Argus is MIT licensed with no paid tier, no seat pricing, and no event quota. You host it, you own the data, and there is nothing to upgrade to.'
  },
  {
    label: 'Do I have to change my application code?',
    content: 'Only the DSN. Argus speaks the Sentry envelope protocol, so the official Sentry SDK you already ship keeps working — same init, same integrations, same breadcrumbs.'
  },
  {
    label: 'What does Argus not do?',
    content: 'Session replay, profiling, cron monitoring, dashboards, and alert routing are not part of Argus today. Performance tracing (tracesSampleRate) is on the roadmap. If you need the full observability suite, Sentry is genuinely good at it — Argus is for teams who only wanted the error tracker.'
  },
  {
    label: 'Where is my data stored?',
    content: 'In the Postgres database you point Argus at. Nothing is sent anywhere else, there is no telemetry, and sensitive fields — cookies, authorization headers, tokens, passwords — are redacted before the event is written.'
  },
  {
    label: 'How do repeated errors get grouped?',
    content: 'By exception type, message, and the top in-app stack frame. If that is wrong for your case, send a fingerprint array with the event and Argus will group on exactly that instead.'
  }
]

const issueRows = [
  {
    type: 'TypeError',
    message: 'Cannot read properties of undefined (reading \'id\')',
    culprit: 'src/composables/useCheckout.ts in loadCustomer',
    release: 'storefront@2.8.0',
    events: '1.2k',
    users: '318',
    age: '2m',
    unhandled: true,
    series: [2, 4, 3, 6, 5, 9, 7, 12, 8, 14, 11, 18, 16, 22, 19, 28, 24, 31, 27, 36, 33, 41, 38, 47]
  },
  {
    type: 'FetchError',
    message: 'POST /api/checkout/confirm failed with 500',
    culprit: 'server/api/checkout/confirm.post.ts in handler',
    release: 'api@1.19.2',
    events: '486',
    users: '204',
    age: '14m',
    unhandled: false,
    series: [8, 6, 9, 5, 7, 4, 6, 3, 8, 5, 9, 6, 4, 7, 5, 8, 6, 9, 7, 5, 8, 6, 9, 7]
  },
  {
    type: 'UnhandledRejection',
    message: 'Payment intent expired before confirmation',
    culprit: 'src/pages/checkout/confirm.vue in onConfirm',
    release: 'storefront@2.8.0',
    events: '92',
    users: '61',
    age: '1h',
    unhandled: true,
    series: [0, 0, 1, 0, 2, 1, 3, 2, 4, 1, 3, 5, 2, 4, 3, 6, 2, 5, 4, 7, 3, 6, 5, 8]
  }
]
</script>

<template>
  <div class="min-h-screen bg-default">
    <header class="sticky top-0 z-50 border-b border-default bg-default/80 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <NuxtLink to="/" class="flex items-center gap-2 font-bold tracking-tight">
          <span class="grid size-8 place-items-center rounded-lg bg-neutral-950">
            <img src="/argus-logo.png" alt="" class="size-6 object-contain">
          </span>
          Argus
        </NuxtLink>
        <nav class="hidden items-center gap-1 text-sm text-muted md:flex">
          <a href="#features" class="rounded-md px-3 py-1.5 hover:bg-elevated hover:text-highlighted">Features</a>
          <a href="#compare" class="rounded-md px-3 py-1.5 hover:bg-elevated hover:text-highlighted">Compare</a>
          <a href="#self-host" class="rounded-md px-3 py-1.5 hover:bg-elevated hover:text-highlighted">Self-host</a>
          <a href="#faq" class="rounded-md px-3 py-1.5 hover:bg-elevated hover:text-highlighted">FAQ</a>
        </nav>
        <div class="ml-auto flex items-center gap-2">
          <UButton :href="links.github" target="_blank" icon="i-simple-icons-github" color="neutral" variant="ghost" class="hidden sm:flex" aria-label="Argus on GitHub" />
          <template v-if="isSignedIn">
            <UButton to="/dashboard" label="Dashboard" trailing-icon="i-lucide-layout-dashboard" />
          </template>
          <template v-else>
            <UButton to="/sign-in" label="Sign in" color="neutral" variant="ghost" />
            <UButton to="/sign-in" label="Get started" trailing-icon="i-lucide-arrow-right" />
          </template>
        </div>
      </div>
    </header>

    <main>
      <!-- Hero -->
      <section class="relative overflow-hidden border-b border-default">
        <div class="pointer-events-none absolute inset-x-0 -top-40 h-[32rem] bg-[radial-gradient(60%_60%_at_50%_0%,var(--ui-primary)_0%,transparent_70%)] opacity-[0.12]" />
        <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--ui-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--ui-border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(70%_50%_at_50%_0%,black,transparent)]" />

        <div class="relative mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <div class="mx-auto max-w-3xl text-center">
            <div class="flex flex-wrap items-center justify-center gap-2">
              <UBadge color="primary" variant="subtle" icon="i-lucide-scale">MIT licensed</UBadge>
              <UBadge color="neutral" variant="subtle" icon="i-lucide-server">Self-hosted</UBadge>
              <UBadge color="neutral" variant="subtle" icon="i-lucide-plug-zap">Sentry SDK compatible</UBadge>
            </div>

            <h1 class="mt-7 text-5xl font-semibold tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              A hundred eyes on<br class="hidden sm:block"> your production errors.
            </h1>

            <p class="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted">
              Argus is a free and open source error tracker — the small, self-hosted alternative to Sentry.
              Keep the SDK you already ship, change one line, and every exception lands grouped and readable in your own database.
            </p>

            <div class="mt-9 flex flex-wrap items-center justify-center gap-3">
              <UButton :to="isSignedIn ? '/dashboard' : '/sign-in'" size="xl" :label="isSignedIn ? 'Open dashboard' : 'Start tracking errors'" trailing-icon="i-lucide-arrow-right" />
              <UButton :href="links.github" target="_blank" size="xl" label="Star on GitHub" color="neutral" variant="outline" icon="i-simple-icons-github" />
            </div>

            <div class="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
              <span class="flex items-center gap-2"><UIcon name="i-lucide-check" class="size-4 text-primary" /> No seat pricing</span>
              <span class="flex items-center gap-2"><UIcon name="i-lucide-check" class="size-4 text-primary" /> No event quota</span>
              <span class="flex items-center gap-2"><UIcon name="i-lucide-check" class="size-4 text-primary" /> No telemetry</span>
            </div>
          </div>

          <!-- Product preview -->
          <div class="relative mx-auto mt-16 max-w-5xl">
            <div class="overflow-hidden rounded-xl border border-default bg-elevated/50 shadow-2xl shadow-black/10 backdrop-blur">
              <div class="flex items-center gap-2 border-b border-default px-4 py-3">
                <span class="size-2.5 rounded-full bg-error/70" /><span class="size-2.5 rounded-full bg-warning/70" /><span class="size-2.5 rounded-full bg-success/70" />
                <span class="ml-3 truncate font-mono text-xs text-dimmed">argus · storefront · unresolved issues</span>
                <span class="ml-auto hidden items-center gap-1 rounded-md bg-default px-2 py-1 font-mono text-[10px] text-dimmed sm:flex">
                  <UIcon name="i-lucide-search" class="size-3" /> press / to search
                </span>
              </div>

              <div class="grid grid-cols-4 divide-x divide-default border-b border-default bg-default/60 text-left">
                <div class="px-4 py-3">
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">Unresolved</p>
                  <p class="mt-0.5 text-lg font-semibold tabular-nums text-error">14</p>
                </div>
                <div class="px-4 py-3">
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">New today</p>
                  <p class="mt-0.5 text-lg font-semibold tabular-nums text-warning">3</p>
                </div>
                <div class="px-4 py-3">
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">Events 24h</p>
                  <p class="mt-0.5 text-lg font-semibold tabular-nums text-highlighted">1.8k</p>
                </div>
                <div class="px-4 py-3">
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">Users</p>
                  <p class="mt-0.5 text-lg font-semibold tabular-nums text-highlighted">583</p>
                </div>
              </div>

              <div class="divide-y divide-default bg-default/40 text-left">
                <div
                  v-for="(row, index) in issueRows"
                  :key="row.message"
                  class="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-4 border-l-2 py-3 pl-4 pr-4 lg:grid-cols-[minmax(0,1fr)_7rem_4rem_3.5rem_3rem]"
                  :class="[index === 0 ? 'border-error bg-error/[0.04]' : 'border-error/40']"
                >
                  <div class="min-w-0">
                    <div class="flex min-w-0 items-center gap-1.5">
                      <code class="shrink-0 font-mono text-xs font-semibold text-error">{{ row.type }}</code>
                      <UBadge v-if="row.unhandled" color="error" variant="solid" size="sm">unhandled</UBadge>
                      <span class="rounded bg-accented/50 px-1 font-mono text-[10px] text-dimmed">production</span>
                    </div>
                    <p class="mt-0.5 truncate text-sm font-medium text-highlighted">{{ row.message }}</p>
                    <p class="mt-0.5 truncate font-mono text-[11px] text-dimmed">{{ row.culprit }} · {{ row.release }}</p>
                  </div>
                  <AppSparkline :values="row.series" height="h-7" class="hidden lg:flex" />
                  <span class="hidden text-right font-mono text-xs tabular-nums text-highlighted lg:block">{{ row.events }}</span>
                  <span class="hidden text-right font-mono text-xs tabular-nums text-muted lg:block">{{ row.users }}</span>
                  <span class="text-right font-mono text-xs tabular-nums text-muted">{{ row.age }}</span>
                </div>
              </div>

              <div class="border-t border-default bg-elevated/40 p-4 text-left">
                <div class="flex flex-wrap items-center gap-2">
                  <UIcon name="i-lucide-code-2" class="size-4 text-error" />
                  <span class="font-mono text-sm font-semibold text-highlighted">loadCustomer</span>
                  <UBadge color="error" variant="subtle" size="sm">in app</UBadge>
                  <span class="font-mono text-xs text-dimmed">src/composables/useCheckout.ts:48:22</span>
                </div>
                <div class="mt-3 overflow-x-auto rounded-lg border border-default bg-default p-3 font-mono text-xs leading-6">
                  <p class="text-dimmed"><span class="mr-4 select-none opacity-60">45</span>const response = await checkoutApi.getCustomer(cartId)</p>
                  <p class="text-dimmed"><span class="mr-4 select-none opacity-60">46</span>const customer = response.data.customer</p>
                  <p class="-mx-3 bg-error/10 px-3 text-error"><span class="mr-4 select-none opacity-60">48</span>return customer.id</p>
                  <p class="text-dimmed"><span class="mr-4 select-none opacity-60">49</span>}</p>
                </div>
                <div class="mt-3 flex flex-wrap gap-1.5 font-mono text-[11px]">
                  <span class="rounded bg-elevated px-2 py-1 text-dimmed">browser <span class="text-highlighted">Chrome 140</span></span>
                  <span class="rounded bg-elevated px-2 py-1 text-dimmed">os <span class="text-highlighted">macOS 15.5</span></span>
                  <span class="rounded bg-elevated px-2 py-1 text-dimmed">release <span class="text-highlighted">storefront@2.8.0</span></span>
                  <span class="rounded bg-elevated px-2 py-1 text-dimmed">user <span class="text-highlighted">usr_1042</span></span>
                  <span class="rounded bg-elevated px-2 py-1 text-dimmed">region <span class="text-highlighted">eu-west-1</span></span>
                </div>
              </div>
            </div>
          </div>

          <p class="mx-auto mt-10 max-w-2xl text-center text-sm leading-6 text-dimmed">
            <UIcon name="i-lucide-eye" class="mr-1 inline size-4 align-[-2px] text-primary" />
            Argus Panoptes, the hundred-eyed giant of Greek myth, was set to watch and never sleep with all his eyes at once. Fitting name for something that stares at production so you do not have to.
          </p>
        </div>
      </section>

      <!-- Positioning -->
      <section class="border-b border-default bg-elevated/40">
        <div class="mx-auto grid max-w-6xl gap-8 px-6 py-16 lg:grid-cols-3">
          <div class="lg:col-span-1">
            <h2 class="text-3xl font-semibold tracking-tight">Sentry is great. It is also enormous.</h2>
            <p class="mt-4 text-muted">
              Most teams adopt Sentry for one reason: to see the errors their users hit.
              Then they inherit tracing pipelines, replay storage, quotas, and a self-hosted stack of twenty-odd services.
              Argus keeps the part you wanted.
            </p>
          </div>
          <div class="grid gap-4 sm:grid-cols-3 lg:col-span-2">
            <div v-for="item in [
              { icon: 'i-lucide-package', title: 'Two moving parts', text: 'A Nuxt server and a Postgres database. Deploy it on the box you already have.' },
              { icon: 'i-lucide-unlock', title: 'MIT, not source-available', text: 'Fork it, change it, run it commercially. No license that expires into a paywall.' },
              { icon: 'i-lucide-arrow-left-right', title: 'No lock-in either way', text: 'It speaks the Sentry protocol. Switching to or from Argus is a DSN change.' }
            ]" :key="item.title" class="rounded-xl border border-default bg-default p-5">
              <span class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><UIcon :name="item.icon" class="size-4" /></span>
              <h3 class="mt-4 font-semibold">{{ item.title }}</h3>
              <p class="mt-2 text-sm leading-6 text-muted">{{ item.text }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Features -->
      <section id="features" class="border-b border-default scroll-mt-16">
        <div class="mx-auto max-w-6xl px-6 py-20">
          <div class="max-w-2xl">
            <UBadge color="neutral" variant="subtle">What you get</UBadge>
            <h2 class="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Everything the SDK sent. Nothing it did not.</h2>
            <p class="mt-4 text-muted">An error tracker that does the whole job of an error tracker, and stops there.</p>
          </div>

          <div class="mt-12 grid gap-px overflow-hidden rounded-xl border border-default bg-default sm:grid-cols-2 lg:grid-cols-4">
            <div v-for="feature in features" :key="feature.title" class="bg-default p-6 outline outline-default/60 transition hover:bg-elevated/50">
              <span class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><UIcon :name="feature.icon" class="size-4" /></span>
              <h3 class="mt-4 font-semibold">{{ feature.title }}</h3>
              <p class="mt-2 text-sm leading-6 text-muted">{{ feature.text }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- SDK compatibility -->
      <section class="border-b border-default bg-elevated/40">
        <div class="mx-auto max-w-6xl px-6 py-16">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div class="max-w-xl">
              <h2 class="text-2xl font-semibold tracking-tight">Keep your SDK. Change the DSN.</h2>
              <p class="mt-3 text-muted">Argus accepts the standard Sentry envelope, so the official SDKs report to it unchanged — including breadcrumbs, contexts, releases, and custom tags.</p>
            </div>
            <UButton :href="links.sentrySdks" target="_blank" color="neutral" variant="outline" label="Sentry SDK docs" trailing-icon="i-lucide-external-link" />
          </div>
          <div class="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-default bg-default sm:grid-cols-6 lg:grid-cols-9">
            <div v-for="sdk in sdks" :key="sdk.label" class="flex flex-col items-center gap-2 bg-default px-3 py-5 outline outline-default/60">
              <UIcon :name="sdk.icon" class="size-6 text-muted" />
              <span class="text-center text-[11px] text-dimmed">{{ sdk.label }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Comparison -->
      <section id="compare" class="border-b border-default scroll-mt-16">
        <div class="mx-auto max-w-4xl px-6 py-20">
          <div class="max-w-2xl">
            <UBadge color="neutral" variant="subtle">Honest comparison</UBadge>
            <h2 class="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Where Argus fits</h2>
            <p class="mt-4 text-muted">If you need the full observability suite, use Sentry — it is very good. If you wanted the error inbox without the rest, that is this.</p>
          </div>

          <div class="mt-10 overflow-hidden rounded-xl border border-default">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-default bg-elevated/60 text-left">
                  <th class="px-4 py-3 font-medium text-muted">&nbsp;</th>
                  <th class="px-4 py-3 font-semibold text-highlighted">
                    <span class="flex items-center gap-2">
                      <img src="/argus-logo.png" alt="" class="size-4 object-contain">
                      Argus
                    </span>
                  </th>
                  <th class="px-4 py-3 font-semibold text-muted">Sentry</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="row in comparison" :key="row.feature" class="hover:bg-elevated/40">
                  <td class="px-4 py-3 text-muted">{{ row.feature }}</td>
                  <td class="px-4 py-3">
                    <span v-if="row.argus === 'yes'" class="flex items-center gap-1.5 text-primary"><UIcon name="i-lucide-check" class="size-4" /> Yes</span>
                    <span v-else-if="row.argus === 'no'" class="flex items-center gap-1.5 text-dimmed"><UIcon name="i-lucide-minus" class="size-4" /> Not supported</span>
                    <span v-else-if="row.argus === 'planned'" class="flex items-center gap-1.5 text-warning"><UIcon name="i-lucide-hammer" class="size-4" /> On the roadmap</span>
                    <span v-else class="font-medium text-highlighted">{{ row.argus }}</span>
                  </td>
                  <td class="px-4 py-3 text-muted">
                    <span v-if="row.sentry === 'yes'" class="flex items-center gap-1.5"><UIcon name="i-lucide-check" class="size-4" /> Yes</span>
                    <span v-else>{{ row.sentry }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-4 text-xs text-dimmed">Comparison covers Sentry's hosted plans and its official self-hosted distribution at the time of writing.</p>
        </div>
      </section>

      <!-- Self-host -->
      <section id="self-host" class="border-b border-default bg-elevated/40 scroll-mt-16">
        <div class="mx-auto max-w-6xl px-6 py-20">
          <div class="max-w-2xl">
            <UBadge color="neutral" variant="subtle">Self-host</UBadge>
            <h2 class="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Running in three steps</h2>
            <p class="mt-4 text-muted">No cluster, no queue, no vendor account. Clone, migrate, run.</p>
          </div>

          <div class="mt-12 grid gap-6 lg:grid-cols-3">
            <div v-for="(step, index) in quickstart" :key="step.title" class="flex flex-col rounded-xl border border-default bg-default p-5">
              <div class="flex items-center gap-3">
                <span class="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-inverted">{{ index + 1 }}</span>
                <h3 class="font-semibold">{{ step.title }}</h3>
              </div>
              <p class="mt-3 text-sm leading-6 text-muted">{{ step.text }}</p>
              <div class="relative mt-4 flex-1 rounded-lg border border-default bg-muted p-3">
                <pre class="overflow-x-auto font-mono text-[11px] leading-5 text-highlighted">{{ step.code }}</pre>
                <CopyButton :value="step.code" class="absolute right-1.5 top-1.5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ -->
      <section id="faq" class="border-b border-default scroll-mt-16">
        <div class="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <UBadge color="neutral" variant="subtle">FAQ</UBadge>
            <h2 class="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Straight answers</h2>
            <p class="mt-4 text-muted">Including the parts Argus deliberately does not do.</p>
          </div>
          <UAccordion :items="faq" :ui="{ item: 'border-default' }" />
        </div>
      </section>

      <!-- CTA -->
      <section class="relative overflow-hidden">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_100%,var(--ui-primary)_0%,transparent_70%)] opacity-[0.1]" />
        <div class="relative mx-auto max-w-3xl px-6 py-24 text-center">
          <span class="mx-auto grid size-12 place-items-center rounded-xl bg-neutral-950">
            <img src="/argus-logo.png" alt="" class="size-9 object-contain">
          </span>
          <h2 class="mt-6 text-4xl font-semibold tracking-tight">Watch production. Own the data.</h2>
          <p class="mx-auto mt-4 max-w-xl text-muted">Create an account on this instance and connect your first project in a couple of minutes.</p>
          <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
            <UButton :to="isSignedIn ? '/dashboard' : '/sign-in'" size="xl" :label="isSignedIn ? 'Open dashboard' : 'Create an account'" trailing-icon="i-lucide-arrow-right" />
            <UButton :href="links.github" target="_blank" size="xl" label="Read the source" color="neutral" variant="outline" icon="i-simple-icons-github" />
          </div>
        </div>
      </section>
    </main>

    <footer class="border-t border-default bg-elevated/40">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-4 px-6 py-8 text-sm text-dimmed">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold text-highlighted">
          <span class="grid size-6 place-items-center rounded-md bg-neutral-950">
            <img src="/argus-logo.png" alt="" class="size-4.5 object-contain">
          </span>
          Argus
        </NuxtLink>
        <span>Open source error tracking, MIT licensed.</span>
        <div class="ml-auto flex items-center gap-4">
          <a :href="links.github" target="_blank" class="hover:text-highlighted">GitHub</a>
          <a :href="links.license" target="_blank" class="hover:text-highlighted">License</a>
          <NuxtLink v-if="isSignedIn" to="/dashboard" class="hover:text-highlighted">Dashboard</NuxtLink>
          <NuxtLink v-else to="/sign-in" class="hover:text-highlighted">Sign in</NuxtLink>
        </div>
      </div>
    </footer>
  </div>
</template>
