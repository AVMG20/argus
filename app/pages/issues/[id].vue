<script setup lang="ts">
import type { StoredEvent, UnknownRecord } from '~/utils/sentry'

type IssueResponse = {
  project: { id: string, name: string, slug: string, platform: string }
  issue: {
    id: string
    fingerprint: string
    title: string
    culprit?: string | null
    level: string
    status: string
    eventCount: number
    firstSeen: string
    lastSeen: string
  }
  events: StoredEvent[]
  stats: {
    storedEvents: number
    userCount: number
    events24h: number
    environments: string[]
    releases: string[]
    firstRelease: string | null
    lastRelease: string | null
  }
  series: { hourly: number[], daily: number[] }
  distribution: Array<{ key: string, value: string, count: number }>
}

const route = useRoute()
const toast = useToast()
const { data, status, error, refresh } = await useFetch<IssueResponse>(() => `/api/issues/${route.params.id}`)

const selectedEventId = ref<string>()
const activeTab = ref('stack')
const range = ref<'hourly' | 'daily'>('hourly')
const updating = ref(false)

const events = computed(() => data.value?.events || [])
const selectedEvent = computed(() => events.value.find(item => item.id === selectedEventId.value) || events.value[0])
const eventIndex = computed(() => Math.max(0, events.value.findIndex(item => item.id === selectedEvent.value?.id)))

const payload = computed<UnknownRecord>(() => (selectedEvent.value?.rawPayload as UnknownRecord) || {})
const contexts = computed<UnknownRecord>(() => (selectedEvent.value?.contexts as UnknownRecord) || (payload.value.contexts as UnknownRecord) || {})
const request = computed<UnknownRecord>(() => (selectedEvent.value?.request as UnknownRecord) || (payload.value.request as UnknownRecord) || {})
const user = computed<UnknownRecord>(() => (selectedEvent.value?.user as UnknownRecord) || (payload.value.user as UnknownRecord) || {})
const breadcrumbs = computed<UnknownRecord[]>(() => selectedEvent.value?.breadcrumbs || [])
const sdk = computed<UnknownRecord>(() => (payload.value.sdk as UnknownRecord) || {})

const exceptions = computed(() => exceptionChain(selectedEvent.value))
const frameCount = computed(() => exceptions.value.reduce((count, exception) => count + framesFor(exception).length, 0))
const unhandled = computed(() => isUnhandled(exceptions.value))
const resolved = computed(() => data.value?.issue.status === 'resolved')

const headline = computed(() => {
  const title = data.value?.issue.title || ''
  const separator = title.indexOf(': ')
  return separator > 0
    ? { type: title.slice(0, separator), message: title.slice(separator + 2) }
    : { type: data.value?.issue.level || 'error', message: title }
})

const levelClass = computed(() => ({
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info'
}[levelTone(data.value?.issue.level)] || 'text-error'))

const accentClass = computed(() => {
  if (resolved.value) return 'border-l-success'
  return { error: 'border-l-error', warning: 'border-l-warning', info: 'border-l-info' }[levelTone(data.value?.issue.level)] || 'border-l-error'
})

const volumeRanges = [
  { label: '24h', value: 'hourly' },
  { label: '30d', value: 'daily' }
] as const satisfies ReadonlyArray<{ label: string, value: 'hourly' | 'daily' }>

const series = computed(() => data.value?.series[range.value] || [])
const seriesLabels = computed(() => series.value.map((_, index) => {
  const ago = series.value.length - 1 - index
  return range.value === 'hourly' ? (ago ? `${ago}h ago` : 'this hour') : (ago ? `${ago}d ago` : 'today')
}))

const metrics = computed(() => [
  { label: 'Events', value: formatCount(data.value?.issue.eventCount), hint: `${data.value?.stats.storedEvents || 0} stored` },
  { label: 'Users', value: formatCount(data.value?.stats.userCount), hint: data.value?.stats.userCount ? 'affected' : 'none identified' },
  { label: 'Last 24h', value: formatCount(data.value?.stats.events24h), hint: 'events' },
  { label: 'First seen', value: formatAge(data.value?.issue.firstSeen), hint: data.value?.stats.firstRelease || 'ago' },
  { label: 'Last seen', value: formatAge(data.value?.issue.lastSeen), hint: data.value?.stats.lastRelease || 'ago' }
])

/** The one-line ribbon that answers "where did this happen" without opening a tab. */
const ribbon = computed(() => {
  const browser = isRecord(contexts.value.browser) ? contexts.value.browser : {}
  const os = isRecord(contexts.value.os) ? contexts.value.os : {}
  return [
    { label: 'env', value: selectedEvent.value?.environment },
    { label: 'release', value: selectedEvent.value?.release },
    { label: 'transaction', value: selectedEvent.value?.transaction || payload.value.transaction },
    { label: 'url', value: request.value.url },
    { label: 'browser', value: [browser.name, browser.version].filter(Boolean).join(' ').slice(0, 40) },
    { label: 'os', value: [os.name, os.version].filter(Boolean).join(' ') },
    { label: 'user', value: affectedUserLabel(user.value) },
    { label: 'server', value: selectedEvent.value?.serverName },
    { label: 'sdk', value: [sdk.value.name, sdk.value.version].filter(Boolean).join(' ') }
  ].filter(item => item.value)
})

const tabs = computed(() => [
  { label: 'Stack trace', value: 'stack', icon: 'i-lucide-list-tree', count: frameCount.value },
  { label: 'Breadcrumbs', value: 'breadcrumbs', icon: 'i-lucide-footprints', count: breadcrumbs.value.length },
  { label: 'Request', value: 'request', icon: 'i-lucide-globe', count: Object.keys(request.value).length },
  { label: 'Context', value: 'context', icon: 'i-lucide-panels-top-left', count: Object.keys(contexts.value).length + (hasValues(user.value) ? 1 : 0) },
  { label: 'Tags & SDK', value: 'metadata', icon: 'i-lucide-tags', count: recordEntries(selectedEvent.value?.tags).length },
  { label: 'Raw', value: 'raw', icon: 'i-lucide-braces', count: 0 }
])

function stepEvent(offset: number) {
  const next = events.value[eventIndex.value + offset]
  if (next) selectedEventId.value = next.id
}

async function toggleStatus() {
  if (!data.value || updating.value) return
  updating.value = true
  const next = resolved.value ? 'unresolved' : 'resolved'
  try {
    await $fetch(`/api/issues/${route.params.id}`, { method: 'PATCH', body: { status: next } })
    await refresh()
    toast.add({
      title: next === 'resolved' ? 'Issue resolved' : 'Issue reopened',
      icon: next === 'resolved' ? 'i-lucide-circle-check-big' : 'i-lucide-rotate-ccw',
      color: next === 'resolved' ? 'success' : 'primary'
    })
  } finally {
    updating.value = false
  }
}

defineShortcuts({
  j: () => stepEvent(1),
  k: () => stepEvent(-1),
  r: toggleStatus,
  1: () => activeTab.value = 'stack',
  2: () => activeTab.value = 'breadcrumbs',
  3: () => activeTab.value = 'request',
  4: () => activeTab.value = 'context',
  5: () => activeTab.value = 'metadata',
  6: () => activeTab.value = 'raw'
})
</script>

<template>
  <UDashboardPanel id="issue-detail">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'gap-2' }">
        <template #leading>
          <AppNavbarLeading
            :back-to="data ? `/projects/${data.project.id}` : '/dashboard'"
            back-label="Back to issues"
          />
        </template>
        <template #default>
          <div class="flex min-w-0 items-center gap-2">
            <span class="shrink-0 text-xs text-dimmed">{{ data?.project.name }}</span>
            <span class="shrink-0 text-dimmed">/</span>
            <code class="truncate font-mono text-xs text-muted">{{ headline.type }}</code>
          </div>
        </template>
        <template #right>
          <UBadge
            v-if="data"
            :color="resolved ? 'success' : 'neutral'"
            variant="subtle"
            size="sm"
            class="hidden sm:inline-flex"
          >
            {{ data.issue.status }}
          </UBadge>
          <UButton
            v-if="data"
            :icon="resolved ? 'i-lucide-rotate-ccw' : 'i-lucide-check'"
            :label="resolved ? 'Reopen' : 'Resolve'"
            :color="resolved ? 'neutral' : 'primary'"
            :variant="resolved ? 'outline' : 'solid'"
            size="sm"
            :loading="updating"
            @click="toggleStatus"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="data && selectedEvent"
        class="mx-auto w-full max-w-[110rem] space-y-3 pb-10"
      >
        <header class="overflow-hidden rounded-lg border border-default bg-elevated/20">
          <div
            class="border-l-2 px-4 py-3"
            :class="accentClass"
          >
            <div class="flex flex-wrap items-center gap-1.5">
              <UIcon
                :name="levelIcon(data.issue.level)"
                class="size-4"
                :class="levelClass"
              />
              <code class="text-sm font-semibold text-highlighted">{{ headline.type }}</code>
              <UBadge
                :color="unhandled ? 'error' : 'neutral'"
                :variant="unhandled ? 'solid' : 'outline'"
                size="sm"
              >
                {{ unhandled ? 'unhandled' : 'handled' }}
              </UBadge>
              <UBadge
                v-if="exceptions.length > 1"
                color="neutral"
                variant="outline"
                size="sm"
              >
                {{ exceptions.length }} chained
              </UBadge>
              <span class="ml-auto font-mono text-[11px] text-dimmed">
                {{ selectedEvent.eventId }}
              </span>
              <CopyButton
                :value="selectedEvent.eventId"
                aria-label="Copy event id"
              />
            </div>

            <h1 class="mt-1.5 break-words text-lg font-semibold leading-snug text-highlighted sm:text-xl">
              {{ headline.message }}
            </h1>
            <p
              v-if="data.issue.culprit"
              class="mt-1 break-all font-mono text-xs text-muted"
            >
              {{ data.issue.culprit }}
            </p>
          </div>

          <div class="flex flex-wrap items-stretch border-t border-default">
            <div
              v-for="metric in metrics"
              :key="metric.label"
              class="min-w-28 flex-1 border-r border-default px-3 py-2 last:border-r-0"
            >
              <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">
                {{ metric.label }}
              </p>
              <p class="mt-0.5 text-base font-semibold tabular-nums leading-tight text-highlighted">
                {{ metric.value }}
              </p>
              <p class="truncate text-[10px] text-dimmed">
                {{ metric.hint }}
              </p>
            </div>
            <div class="min-w-56 flex-[2] px-3 py-2">
              <div class="flex items-center justify-between">
                <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">
                  Volume
                </p>
                <AppRangeTabs
                  v-model="range"
                  :items="volumeRanges"
                  aria-label="Volume range"
                />
              </div>
              <AppVolumeChart
                :values="series"
                :labels="seriesLabels"
                :height="38"
                class="mt-1"
                :tone="resolved ? 'neutral' : 'error'"
              />
            </div>
          </div>

          <div
            v-if="ribbon.length"
            class="flex flex-wrap gap-x-4 gap-y-1 border-t border-default bg-elevated/40 px-4 py-2"
          >
            <span
              v-for="item in ribbon"
              :key="item.label"
              class="flex min-w-0 items-baseline gap-1.5 text-[11px]"
            >
              <span class="shrink-0 text-dimmed">{{ item.label }}</span>
              <span
                class="max-w-72 truncate font-mono text-muted"
                :title="String(item.value)"
              >{{ item.value }}</span>
            </span>
          </div>
        </header>

        <div class="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div class="min-w-0 space-y-3">
            <nav class="-mx-1 flex gap-1 overflow-x-auto px-1 pb-px">
              <button
                v-for="tab in tabs"
                :key="tab.value"
                type="button"
                class="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                :class="activeTab === tab.value
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-transparent text-muted hover:bg-elevated/60 hover:text-highlighted'"
                @click="activeTab = tab.value"
              >
                <UIcon
                  :name="tab.icon"
                  class="size-3.5"
                />
                {{ tab.label }}
                <span
                  v-if="tab.count"
                  class="rounded bg-accented/60 px-1 font-mono text-[10px] tabular-nums text-dimmed"
                >{{ tab.count }}</span>
              </button>
            </nav>

            <IssueStackTrace
              v-if="activeTab === 'stack'"
              :exceptions="exceptions"
              :project-id="data.project.id"
            />
            <IssueBreadcrumbs
              v-else-if="activeTab === 'breadcrumbs'"
              :crumbs="breadcrumbs"
              :event-timestamp="selectedEvent.timestamp"
              :event-title="data.issue.title"
            />
            <IssueRequest
              v-else-if="activeTab === 'request'"
              :request="request"
              :contexts="contexts"
            />
            <IssueContexts
              v-else-if="activeTab === 'context'"
              :contexts="contexts"
              :user="user"
              :payload="payload"
            />
            <IssueMetadata
              v-else-if="activeTab === 'metadata'"
              :event="selectedEvent"
              :payload="payload"
              :project-id="data.project.id"
              :fingerprint="data.issue.fingerprint"
            />
            <IssueRaw
              v-else
              :payload="selectedEvent.rawPayload || selectedEvent"
              :event-id="selectedEvent.eventId"
            />
          </div>

          <aside class="min-w-0 space-y-3 xl:sticky xl:top-2">
            <IssueEventList
              :events="events"
              :selected-id="selectedEvent.id"
              @select="selectedEventId = $event"
            />
            <IssueDistribution
              :distribution="data.distribution"
              :project-id="data.project.id"
            />
            <p class="px-1 text-[10px] leading-5 text-dimmed">
              <UKbd
                value="j"
                size="sm"
              /> / <UKbd
                value="k"
                size="sm"
              /> switch event · <UKbd
                value="1"
                size="sm"
              />–<UKbd
                value="6"
                size="sm"
              /> switch tab · <UKbd
                value="r"
                size="sm"
              /> resolve
            </p>
          </aside>
        </div>
      </div>

      <div
        v-else-if="status === 'pending'"
        class="mx-auto w-full max-w-[110rem] space-y-3"
      >
        <USkeleton class="h-44 w-full rounded-lg" />
        <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <USkeleton class="h-[32rem] rounded-lg" />
          <USkeleton class="h-72 rounded-lg" />
        </div>
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not load this issue"
        :description="error?.statusMessage || error?.message || 'Try refreshing the page.'"
      />

      <UEmpty
        v-else
        icon="i-lucide-file-warning"
        title="No event payloads"
        description="This issue exists, but none of its events were stored."
      />
    </template>
  </UDashboardPanel>
</template>
