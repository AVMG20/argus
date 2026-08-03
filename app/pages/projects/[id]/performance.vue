<script setup lang="ts">
import { CurveType, LegendPosition } from 'vue-chrts/enums'

// The vue-chrts barrel re-exports @unovis/ts maps through a path that only resolves
// inside the package's own nested node_modules, which does not survive into
// .output/server. Charts are client-only, so load the barrel lazily and never on SSR.
const AreaChart = defineAsyncComponent(() => import('vue-chrts').then(module => module.AreaChart))

type Range = '24h' | '7d' | '30d'
type Endpoint = {
  name: string
  method?: string | null
  requests: number
  averageMs: number
  p95Ms: number
  maxMs: number
  failures: number
  lastSeen: string
}
type Transaction = {
  id: string
  eventId: string
  name: string
  method?: string | null
  durationMs: number
  status?: string | null
  statusCode?: number | null
  environment: string
  startTimestamp: string
}
type PerformanceResponse = {
  project: { id: string, name: string, platform: string }
  permissions: { canDelete: boolean }
  range: Range
  endpoint: string | null
  retention: { stored: number, limit: number }
  stats: { requests: number, averageMs: number, p95Ms: number, failureRate: number }
  series: Array<{ at: string, requests: number, averageMs: number, p95Ms: number }>
  endpointsTruncated: boolean
  endpoints: Endpoint[]
  transactions: Transaction[]
}
type EndpointSort = 'requests' | 'average' | 'p95' | 'failures' | 'last'
type RequestSort = 'recent' | 'slowest'

const route = useRoute()
const router = useRouter()

const rangeItems = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' }
]
const rangeTabs = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' }
] as const satisfies ReadonlyArray<{ label: string, value: Range }>
const endpointSortItems = [
  { label: 'Most requested', value: 'requests' },
  { label: 'Slowest average', value: 'average' },
  { label: 'Slowest p95', value: 'p95' },
  { label: 'Most failures', value: 'failures' },
  { label: 'Recently used', value: 'last' }
]
const requestSortItems = [
  { label: 'Most recent', value: 'recent' },
  { label: 'Slowest first', value: 'slowest' }
]
const tracingHighlights = [
  { icon: 'i-lucide-activity', label: 'Request volume', hint: 'bucketed hourly, 6-hourly or daily' },
  { icon: 'i-lucide-timer', label: 'Latency', hint: 'average and p95, per endpoint' },
  { icon: 'i-lucide-triangle-alert', label: 'Failure rate', hint: '5xx responses and failed traces' },
  { icon: 'i-lucide-list-tree', label: 'Individual traces', hint: 'drill into any captured request' }
]

const range = ref<Range>((['24h', '7d', '30d'].includes(String(route.query.range))
  ? String(route.query.range)
  : '7d') as Range)
const activeView = ref<'endpoints' | 'requests'>(route.query.view === 'requests' || route.query.endpoint ? 'requests' : 'endpoints')
const endpoint = ref(String(route.query.endpoint || ''))
const query = ref('')
const endpointSort = ref<EndpointSort>('requests')
const requestSort = ref<RequestSort>('recent')
const cursor = ref(0)
const searchInput = ref<{ inputRef?: HTMLInputElement }>()

const { data, status, error, refresh } = await useFetch<PerformanceResponse>(
  () => `/api/projects/${route.params.id}/performance`,
  { query: computed(() => ({ range: range.value, endpoint: endpoint.value || undefined })) }
)

const rangeLabel = computed(() => ({ '24h': '24 hours', '7d': '7 days', '30d': '30 days' }[range.value]))

/** Buckets are hourly, 6-hourly or daily, so each range gets a label that stays readable. */
const bucketFormatter = computed(() => new Intl.DateTimeFormat('en', range.value === '30d'
  ? { month: 'short', day: 'numeric' }
  : range.value === '7d'
    ? { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: '2-digit', minute: '2-digit', hour12: false }))

const chartData = computed(() => (data.value?.series || []).map(point => ({
  label: bucketFormatter.value.format(new Date(point.at)),
  requests: point.requests,
  average: point.averageMs,
  p95: point.p95Ms
})))
const requestCategories = { requests: { name: 'Requests', color: 'var(--ui-primary)' } }
const latencyCategories = {
  average: { name: 'Average', color: 'var(--ui-primary)' },
  p95: { name: 'P95', color: 'var(--ui-warning)' }
}
const xFormatter = (tick: number) => chartData.value[tick]?.label || ''
const tooltipTitle = (point: { label: string }) => point.label

const endpoints = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return (data.value?.endpoints || [])
    .filter(item => !needle || `${item.method || ''} ${item.name}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      if (endpointSort.value === 'average') return b.averageMs - a.averageMs
      if (endpointSort.value === 'p95') return b.p95Ms - a.p95Ms
      if (endpointSort.value === 'failures') return b.failures - a.failures
      if (endpointSort.value === 'last') return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
      return b.requests - a.requests
    })
})

const requests = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return (data.value?.transactions || [])
    .filter(item => !needle || `${item.method || ''} ${item.name} ${item.environment}`.toLowerCase().includes(needle))
    .sort((a, b) => requestSort.value === 'slowest'
      ? b.durationMs - a.durationMs
      : new Date(b.startTimestamp).getTime() - new Date(a.startTimestamp).getTime())
})

const busiestEndpoint = computed(() => Math.max(1, ...(data.value?.endpoints || []).map(item => item.requests)))
const hasHistory = computed(() => Boolean(data.value && data.value.retention.stored > 0))
// While an endpoint is selected the summary is scoped to it, so an empty summary is not
// an empty range as long as the project-wide endpoint table still has rows.
const hasRangeData = computed(() => Boolean(data.value?.stats.requests) || Boolean(data.value?.endpoints.length))
const isFiltered = computed(() => Boolean(query.value.trim() || endpoint.value))
// A zeroed metric strip and a range picker above "enable tracing" are just noise.
const showSummary = computed(() => !error.value && (status.value === 'pending' || hasHistory.value))
const visibleCount = computed(() => activeView.value === 'endpoints' ? endpoints.value.length : requests.value.length)

const metrics = computed(() => {
  const stats = data.value?.stats
  const retention = data.value?.retention
  const share = retention?.limit ? (retention.stored / retention.limit) * 100 : 0
  const used = share > 0 && share < 1 ? '<1' : Math.min(100, Math.round(share))
  return [
    { label: 'Requests', value: formatCount(stats?.requests), hint: `last ${rangeLabel.value}`, tone: 'text-highlighted' },
    { label: 'Average', value: formatDuration(stats?.averageMs), hint: 'request duration', tone: 'text-highlighted' },
    { label: 'P95', value: formatDuration(stats?.p95Ms), hint: '95th percentile', tone: 'text-highlighted' },
    {
      label: 'Failure rate',
      value: `${(stats?.failureRate || 0).toFixed(1)}%`,
      hint: '5xx and failed traces',
      tone: stats?.failureRate ? 'text-error' : 'text-success'
    },
    { label: 'Stored', value: formatCount(retention?.stored), hint: `${used}% of ${formatCount(retention?.limit)} retained`, tone: 'text-highlighted' }
  ]
})

// Going back to the endpoint table drops the drill-down, same as clearing the filter chip.
watch(activeView, (view) => {
  if (view === 'endpoints') endpoint.value = ''
})

watch([range, activeView, endpoint], () => {
  router.replace({
    query: {
      ...route.query,
      range: range.value === '7d' ? undefined : range.value,
      view: activeView.value === 'endpoints' ? undefined : 'requests',
      endpoint: endpoint.value || undefined
    }
  })
})

watch([endpoints, requests, activeView], () => {
  cursor.value = Math.min(cursor.value, Math.max(0, visibleCount.value - 1))
})

function statusTone(status?: string | null, statusCode?: number | null) {
  if ((statusCode || 0) >= 500 || ['internal_error', 'unknown_error', 'deadline_exceeded', 'unavailable'].includes(status || '')) return 'text-error'
  if ((statusCode || 0) >= 400) return 'text-warning'
  return 'text-success'
}

function toggleSort(key: EndpointSort) {
  endpointSort.value = key
}

/** Drilling into an endpoint refetches its requests server side, so rare endpoints show up too. */
function openEndpoint(name: string) {
  endpoint.value = name
  activeView.value = 'requests'
  cursor.value = 0
}

function clearEndpoint() {
  endpoint.value = ''
  activeView.value = 'endpoints'
  cursor.value = 0
}

function clearFilters() {
  query.value = ''
  clearEndpoint()
}

function moveCursor(offset: number) {
  if (!visibleCount.value) return
  cursor.value = Math.max(0, Math.min(visibleCount.value - 1, cursor.value + offset))
  document.getElementById(`performance-row-${cursor.value}`)?.scrollIntoView({ block: 'nearest' })
}

function openCursor() {
  if (activeView.value === 'endpoints') {
    const selected = endpoints.value[cursor.value]
    if (selected) openEndpoint(selected.name)
    return
  }
  const selected = requests.value[cursor.value]
  if (selected) navigateTo(`/performance/${selected.id}`)
}

defineShortcuts({
  '/': () => searchInput.value?.inputRef?.focus(),
  'j': () => moveCursor(1),
  'k': () => moveCursor(-1),
  'enter': openCursor,
  'escape': () => {
    if (isFiltered.value) clearFilters()
  }
})
</script>

<template>
  <UDashboardPanel id="project-performance">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'gap-2' }">
        <template #leading>
          <AppNavbarLeading
            back-to="/"
            back-label="Back to projects"
          />
        </template>
        <template #default>
          <div class="flex min-w-0 items-center gap-2">
            <h1 class="truncate text-sm font-semibold text-highlighted">
              {{ data?.project.name || 'Performance' }}
            </h1>
            <span class="shrink-0 font-mono text-[11px] text-dimmed">{{ data?.project.platform }}</span>
          </div>
        </template>
        <template #right>
          <UButton
            :to="`/projects/${route.params.id}`"
            label="Issues"
            icon="i-lucide-circle-alert"
            color="neutral"
            variant="outline"
            size="sm"
          />
          <UButton
            :to="`/projects/${route.params.id}/setup`"
            icon="i-lucide-plug"
            label="SDK setup"
            color="neutral"
            variant="outline"
            size="sm"
          />
          <PerformanceDeleteButton
            v-if="data?.permissions.canDelete"
            :project-id="String(route.params.id)"
            :project-name="data.project.name"
            @deleted="refresh"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="performance-page mx-auto w-full max-w-[110rem] space-y-3 pb-10">
        <div
          v-if="showSummary"
          class="flex flex-wrap items-center gap-2 px-0.5"
        >
          <p class="text-[11px] text-dimmed">
            Metrics, charts and requests below cover the last {{ rangeLabel }}.
          </p>
          <AppRangeTabs
            v-model="range"
            :items="rangeTabs"
            aria-label="Time range"
            class="ml-auto"
          />
        </div>

        <section
          v-if="showSummary"
          class="flex flex-wrap items-stretch overflow-hidden rounded-lg border border-default bg-elevated/20"
        >
          <div
            v-for="metric in metrics"
            :key="metric.label"
            class="min-w-32 flex-1 border-r border-default px-3 py-2 last:border-r-0"
          >
            <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">
              {{ metric.label }}
            </p>
            <p
              class="mt-0.5 text-lg font-semibold tabular-nums leading-tight"
              :class="metric.tone"
            >
              {{ metric.value }}
            </p>
            <p class="truncate text-[10px] text-dimmed">
              {{ metric.hint }}
            </p>
          </div>
        </section>

        <div
          v-if="status === 'pending'"
          class="space-y-3"
        >
          <div class="grid gap-3 lg:grid-cols-2">
            <USkeleton class="h-72 rounded-lg" />
            <USkeleton class="h-72 rounded-lg" />
          </div>
          <USkeleton
            v-for="index in 4"
            :key="index"
            class="h-12 rounded-lg"
          />
        </div>

        <UAlert
          v-else-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Could not load performance data"
          :description="error.statusMessage || error.message"
        />

        <section
          v-else-if="!hasHistory"
          class="space-y-3"
        >
          <div class="rounded-lg border border-default bg-elevated/10 px-6 py-12">
            <UEmpty
              icon="i-lucide-activity"
              title="Enable performance tracing"
              description="Error reporting does not send request timings by default. Add a trace sample rate to your Sentry initialization, then make a few requests."
            >
              <div class="flex flex-wrap justify-center gap-2">
                <UButton
                  :to="`/projects/${route.params.id}/setup`"
                  label="Open SDK setup"
                  icon="i-lucide-plug"
                  size="sm"
                />
                <UButton
                  :to="`/projects/${route.params.id}`"
                  label="Back to issues"
                  icon="i-lucide-circle-alert"
                  color="neutral"
                  variant="outline"
                  size="sm"
                />
              </div>
            </UEmpty>
          </div>

          <div class="grid gap-3 lg:grid-cols-2">
            <AppPanel
              title="Add a sample rate"
              icon="i-lucide-code-2"
              hint="JavaScript, Vue, Nuxt, React and Node.js"
              :padded="false"
            >
              <template #actions>
                <CopyButton value="Sentry.init({ dsn: '…', tracesSampleRate: 0.1 })" />
              </template>
              <pre class="overflow-x-auto p-4 font-mono text-xs leading-6 text-muted"><code>Sentry.init({
  dsn: '…',
  // Capture 10% of transactions. Use 1.0 while testing.
  tracesSampleRate: 0.1
})</code></pre>
            </AppPanel>

            <AppPanel
              title="What lands here"
              icon="i-lucide-gauge"
              hint="once traces arrive"
            >
              <ul class="divide-y divide-default">
                <li
                  v-for="item in tracingHighlights"
                  :key="item.label"
                  class="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0"
                >
                  <UIcon
                    :name="item.icon"
                    class="mt-0.5 size-4 shrink-0 text-dimmed"
                  />
                  <div class="min-w-0">
                    <p class="text-xs font-medium text-highlighted">
                      {{ item.label }}
                    </p>
                    <p class="text-[11px] text-dimmed">
                      {{ item.hint }}
                    </p>
                  </div>
                </li>
              </ul>
            </AppPanel>
          </div>

          <UAlert
            color="neutral"
            variant="subtle"
            icon="i-lucide-info"
            title="Sampling controls storage"
            description="A lower rate reduces database growth. Argus retains the newest 1,000,000 transactions per project and automatically removes older traces and spans."
          />
        </section>

        <template v-else>
          <div
            v-if="endpoint"
            class="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1.5"
          >
            <UIcon
              name="i-lucide-filter"
              class="size-3.5 shrink-0 text-primary"
            />
            <span class="min-w-0 flex-1 truncate font-mono text-xs text-primary">{{ endpoint }}</span>
            <span class="hidden text-[11px] text-dimmed sm:block">metrics, charts and requests below are scoped to this endpoint</span>
            <UButton
              label="All endpoints"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="clearEndpoint"
            />
          </div>

          <section class="grid gap-3 lg:grid-cols-2">
            <AppPanel
              title="Request volume"
              :hint="`last ${rangeLabel}`"
              class="chart-surface"
            >
              <ClientOnly>
                <AreaChart
                  :data="chartData"
                  :height="220"
                  :categories="requestCategories"
                  :curve-type="CurveType.MonotoneX"
                  :hide-legend="true"
                  :x-num-ticks="6"
                  :y-num-ticks="4"
                  :y-grid-line="true"
                  :x-axis-config="{ tickTextFontSize: '11px' }"
                  :y-axis-config="{ tickTextFontSize: '11px' }"
                  :gradient-stops="[{ offset: '0%', stopOpacity: 0.22 }, { offset: '100%', stopOpacity: 0.01 }]"
                  :x-formatter="xFormatter"
                  :y-formatter="formatCount"
                  :tooltip-title-formatter="tooltipTitle"
                />
                <template #fallback>
                  <USkeleton class="h-[220px] rounded-lg" />
                </template>
              </ClientOnly>
            </AppPanel>
            <AppPanel
              title="Latency"
              hint="average vs p95"
              class="chart-surface"
            >
              <ClientOnly>
                <AreaChart
                  :data="chartData"
                  :height="220"
                  :categories="latencyCategories"
                  :curve-type="CurveType.MonotoneX"
                  :legend-position="LegendPosition.TopRight"
                  :x-num-ticks="6"
                  :y-num-ticks="4"
                  :y-grid-line="true"
                  :x-axis-config="{ tickTextFontSize: '11px' }"
                  :y-axis-config="{ tickTextFontSize: '11px' }"
                  :gradient-stops="[{ offset: '0%', stopOpacity: 0.18 }, { offset: '100%', stopOpacity: 0.01 }]"
                  :x-formatter="xFormatter"
                  :y-formatter="formatDuration"
                  :tooltip-title-formatter="tooltipTitle"
                />
                <template #fallback>
                  <USkeleton class="h-[220px] rounded-lg" />
                </template>
              </ClientOnly>
            </AppPanel>
          </section>

          <section class="sticky top-0 z-10 space-y-2 rounded-lg border border-default bg-default/95 p-2 backdrop-blur">
            <div class="flex flex-wrap items-center gap-2">
              <UTabs
                v-model="activeView"
                :items="[
                  { label: 'Endpoints', value: 'endpoints' },
                  { label: 'Requests', value: 'requests' }
                ]"
                :content="false"
                size="xs"
                class="shrink-0"
              />
              <UInput
                ref="searchInput"
                v-model="query"
                icon="i-lucide-search"
                size="sm"
                :placeholder="activeView === 'endpoints' ? 'Search endpoint…' : 'Search request, environment…'"
                class="min-w-0 flex-1 sm:max-w-xs"
              >
                <template #trailing>
                  <UKbd value="/" />
                </template>
              </UInput>
              <USelect
                v-if="activeView === 'endpoints'"
                v-model="endpointSort"
                :items="endpointSortItems"
                icon="i-lucide-arrow-down-wide-narrow"
                size="sm"
                class="w-44"
              />
              <USelect
                v-else
                v-model="requestSort"
                :items="requestSortItems"
                icon="i-lucide-arrow-down-wide-narrow"
                size="sm"
                class="w-40"
              />
              <UButton
                v-if="isFiltered"
                label="Clear"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="clearFilters"
              />
              <span class="ml-auto shrink-0 font-mono text-[11px] text-dimmed">
                {{ visibleCount }} {{ activeView === 'endpoints' ? 'endpoints' : 'requests' }}
              </span>
            </div>
          </section>

          <section
            v-if="!hasRangeData"
            class="rounded-lg border border-default bg-elevated/10"
          >
            <UEmpty
              icon="i-lucide-clock"
              :title="`No requests in the last ${rangeLabel}`"
              description="Traces were captured before, but nothing arrived in this window. Try a wider range."
              class="py-16"
            >
              <div class="flex gap-2">
                <UButton
                  v-for="item in rangeItems.filter(option => option.value !== range)"
                  :key="item.value"
                  :label="item.label"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  @click="range = item.value as Range"
                />
              </div>
            </UEmpty>
          </section>

          <section
            v-else-if="activeView === 'endpoints'"
            aria-label="Endpoints"
            class="overflow-hidden rounded-lg border border-default"
          >
            <div class="grid grid-cols-[minmax(0,1fr)_5rem] gap-3 border-b border-default bg-elevated/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-dimmed md:grid-cols-[minmax(0,1fr)_5rem_6rem_6rem_5rem_5rem]">
              <span>Endpoint</span>
              <button
                v-for="column in [
                  { key: 'requests', label: 'Requests', mobile: true },
                  { key: 'average', label: 'Average', mobile: false },
                  { key: 'p95', label: 'P95', mobile: false },
                  { key: 'failures', label: 'Failures', mobile: false },
                  { key: 'last', label: 'Last', mobile: false }
                ]"
                :key="column.key"
                type="button"
                class="flex items-center justify-end gap-1 uppercase tracking-wider transition-colors hover:text-highlighted"
                :class="[
                  column.mobile ? '' : 'hidden md:flex',
                  endpointSort === column.key ? 'text-highlighted' : ''
                ]"
                :aria-pressed="endpointSort === column.key"
                @click="toggleSort(column.key as EndpointSort)"
              >
                {{ column.label }}
                <UIcon
                  v-if="endpointSort === column.key"
                  name="i-lucide-chevron-down"
                  class="size-3"
                />
              </button>
            </div>

            <UEmpty
              v-if="!endpoints.length"
              icon="i-lucide-search-x"
              title="No endpoints match this search"
              description="Try another term or clear the search."
              class="py-16"
            >
              <UButton
                label="Clear search"
                color="neutral"
                variant="outline"
                size="sm"
                @click="clearFilters"
              />
            </UEmpty>

            <div
              v-else
              class="divide-y divide-default"
            >
              <button
                v-for="(item, index) in endpoints"
                :id="`performance-row-${index}`"
                :key="item.name"
                type="button"
                class="group grid w-full grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 px-3 py-2 text-left transition-colors md:grid-cols-[minmax(0,1fr)_5rem_6rem_6rem_5rem_5rem]"
                :class="cursor === index ? 'bg-elevated/60' : 'hover:bg-elevated/40'"
                :title="`Show the ${item.requests} captured requests for ${item.name}`"
                @mouseenter="cursor = index"
                @click="openEndpoint(item.name)"
              >
                <span class="min-w-0">
                  <span class="flex items-center gap-2">
                    <span class="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{{ item.method || 'TRACE' }}</span>
                    <code class="truncate font-mono text-xs font-medium text-highlighted group-hover:text-primary">{{ item.name }}</code>
                  </span>
                  <span
                    class="mt-1 block h-0.5 rounded-full bg-primary/40"
                    :style="{ width: `${Math.max(2, (item.requests / busiestEndpoint) * 100)}%` }"
                  />
                  <span class="mt-1 block font-mono text-[10px] text-dimmed md:hidden">
                    avg {{ formatDuration(item.averageMs) }} · p95 {{ formatDuration(item.p95Ms) }} · {{ item.failures }} failed
                  </span>
                </span>
                <span class="text-right font-mono text-xs tabular-nums text-highlighted">{{ formatCount(item.requests) }}</span>
                <span class="hidden text-right font-mono text-xs tabular-nums text-muted md:block">{{ formatDuration(item.averageMs) }}</span>
                <span
                  class="hidden text-right font-mono text-xs tabular-nums md:block"
                  :class="item.p95Ms >= (data?.stats.p95Ms || Infinity) ? 'text-warning' : 'text-muted'"
                  :title="`Slowest ${formatDuration(item.maxMs)}`"
                >{{ formatDuration(item.p95Ms) }}</span>
                <span
                  class="hidden text-right font-mono text-xs tabular-nums md:block"
                  :class="item.failures ? 'text-error' : 'text-dimmed'"
                  :title="`${((item.failures / Math.max(1, item.requests)) * 100).toFixed(1)}% of requests failed`"
                >{{ item.failures }}</span>
                <span
                  class="hidden text-right font-mono text-xs tabular-nums text-dimmed md:block"
                  :title="formatAbsolute(item.lastSeen)"
                >{{ formatAge(item.lastSeen) }}</span>
              </button>
            </div>

            <p
              v-if="data?.endpointsTruncated"
              class="border-t border-default bg-elevated/20 px-3 py-1.5 text-[10px] text-dimmed"
            >
              Showing the 100 busiest endpoints in this range.
            </p>
          </section>

          <section
            v-else
            aria-label="Requests"
            class="overflow-hidden rounded-lg border border-default"
          >
            <div class="grid grid-cols-[minmax(0,1fr)_5rem] gap-3 border-b border-default bg-elevated/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-dimmed md:grid-cols-[minmax(0,1fr)_5rem_5rem_7rem]">
              <span>Request</span>
              <span class="text-right">Duration</span>
              <span class="hidden text-right md:block">Status</span>
              <span class="hidden text-right md:block">When</span>
            </div>

            <UEmpty
              v-if="!requests.length"
              icon="i-lucide-search-x"
              :title="endpoint ? 'No requests for this endpoint' : 'No requests match this search'"
              :description="endpoint
                ? `Nothing was captured for ${endpoint} in the last ${rangeLabel}.`
                : 'Try another term or clear the search.'"
              class="py-16"
            >
              <UButton
                label="Clear filters"
                color="neutral"
                variant="outline"
                size="sm"
                @click="clearFilters"
              />
            </UEmpty>

            <div
              v-else
              class="divide-y divide-default"
            >
              <NuxtLink
                v-for="(item, index) in requests"
                :id="`performance-row-${index}`"
                :key="item.id"
                :to="`/performance/${item.id}`"
                class="group grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 px-3 py-2 transition-colors md:grid-cols-[minmax(0,1fr)_5rem_5rem_7rem]"
                :class="cursor === index ? 'bg-elevated/60' : 'hover:bg-elevated/40'"
                @mouseenter="cursor = index"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{{ item.method || 'TRACE' }}</span>
                    <code class="truncate font-mono text-xs text-highlighted group-hover:text-primary">{{ item.name }}</code>
                  </div>
                  <p class="mt-0.5 truncate font-mono text-[10px] text-dimmed">
                    {{ item.environment }} · {{ item.eventId }}<span class="md:hidden"> · {{ item.statusCode || item.status || 'ok' }} · {{ formatAge(item.startTimestamp) }} ago</span>
                  </p>
                </div>
                <span
                  class="text-right font-mono text-xs font-semibold tabular-nums"
                  :class="item.durationMs >= (data?.stats.p95Ms || Infinity) ? 'text-warning' : 'text-highlighted'"
                  :title="item.durationMs >= (data?.stats.p95Ms || Infinity) ? 'At or above the project p95' : undefined"
                >{{ formatDuration(item.durationMs) }}</span>
                <span
                  class="hidden text-right font-mono text-xs tabular-nums md:block"
                  :class="statusTone(item.status, item.statusCode)"
                >{{ item.statusCode || item.status || 'ok' }}</span>
                <span
                  class="hidden text-right font-mono text-xs text-dimmed md:block"
                  :title="formatAbsolute(item.startTimestamp)"
                >{{ formatAge(item.startTimestamp) }} ago</span>
              </NuxtLink>
            </div>

            <p
              v-if="requests.length >= 100"
              class="border-t border-default bg-elevated/20 px-3 py-1.5 text-[10px] text-dimmed"
            >
              Showing the 100 most recent requests{{ endpoint ? ' for this endpoint' : '' }} in this range.
            </p>
          </section>

          <p class="px-1 text-[10px] text-dimmed">
            <UKbd
              value="/"
              size="sm"
            /> search · <UKbd
              value="j"
              size="sm"
            /> / <UKbd
              value="k"
              size="sm"
            /> move · <UKbd
              value="enter"
              size="sm"
            /> {{ activeView === 'endpoints' ? 'drill into endpoint' : 'open request' }} · <UKbd
              value="esc"
              size="sm"
            /> clear filters
          </p>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
