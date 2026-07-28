<script setup lang="ts">
type UnknownRecord = Record<string, unknown>
type Span = {
  id: string
  spanId: string
  parentSpanId?: string | null
  operation?: string | null
  description?: string | null
  startTimestamp: string
  endTimestamp: string
  durationMs: number
  status?: string | null
  data?: UnknownRecord | null
  tags?: Record<string, string> | null
}
type TransactionResponse = {
  project: { id: string, name: string }
  transaction: {
    id: string
    eventId: string
    name: string
    operation?: string | null
    traceId?: string | null
    spanId?: string | null
    startTimestamp: string
    endTimestamp: string
    durationMs: number
    status?: string | null
    method?: string | null
    statusCode?: number | null
    environment: string
    release?: string | null
    user?: UnknownRecord | null
    request?: UnknownRecord | null
    tags?: Record<string, string> | null
    contexts?: UnknownRecord | null
    measurements?: UnknownRecord | null
    rawPayload?: UnknownRecord | null
  }
  spans: Span[]
  peers: Array<{ id: string, durationMs: number, status?: string | null, statusCode?: number | null, startTimestamp: string }>
  stats: { requests: number, averageMs: number, p95Ms: number }
}

const route = useRoute()
const { data, status, error } = await useFetch<TransactionResponse>(() => `/api/transactions/${route.params.id}`)
const selectedSpanId = ref<string>()
const activeTab = ref<'spans' | 'request' | 'context' | 'raw'>('spans')
const tabs: Array<{ value: 'spans' | 'request' | 'context' | 'raw', label: string, icon: string, count?: number }> = [
  { value: 'spans', label: 'Trace', icon: 'i-lucide-gantt-chart' },
  { value: 'request', label: 'Request', icon: 'i-lucide-globe' },
  { value: 'context', label: 'Context', icon: 'i-lucide-panels-top-left' },
  { value: 'raw', label: 'Raw', icon: 'i-lucide-braces' }
]
const selectedSpan = computed(() => data.value?.spans.find(span => span.id === selectedSpanId.value))
const startMs = computed(() => toDate(data.value?.transaction.startTimestamp)?.getTime() || 0)
const totalMs = computed(() => Math.max(1, data.value?.transaction.durationMs || 1))

const metrics = computed(() => [
  { label: 'Duration', value: formatDuration(data.value?.transaction.durationMs), hint: data.value?.transaction.durationMs && data.value.transaction.durationMs >= data.value.stats.p95Ms ? 'at or above p95' : 'request total' },
  { label: 'Endpoint average', value: formatDuration(data.value?.stats.averageMs), hint: `${formatCount(data.value?.stats.requests)} retained requests` },
  { label: 'Endpoint p95', value: formatDuration(data.value?.stats.p95Ms), hint: '95th percentile' },
  { label: 'Spans', value: formatCount(data.value?.spans.length), hint: 'instrumented operations' },
  { label: 'Started', value: formatAge(data.value?.transaction.startTimestamp), hint: formatClock(data.value?.transaction.startTimestamp) }
])

const ribbon = computed(() => {
  const transaction = data.value?.transaction
  if (!transaction) return []
  return [
    { label: 'environment', value: transaction.environment },
    { label: 'release', value: transaction.release },
    { label: 'operation', value: transaction.operation },
    { label: 'trace', value: transaction.traceId },
    { label: 'event', value: transaction.eventId }
  ].filter(item => item.value)
})

function spanStyle(span: Span) {
  const spanStart = toDate(span.startTimestamp)?.getTime() || startMs.value
  const left = Math.max(0, Math.min(100, ((spanStart - startMs.value) / totalMs.value) * 100))
  const width = Math.max(0.5, Math.min(100 - left, (span.durationMs / totalMs.value) * 100))
  return { left: `${left}%`, width: `${width}%` }
}

function operationTone(operation?: string | null) {
  if (operation?.startsWith('db')) return 'bg-warning'
  if (operation?.startsWith('http')) return 'bg-info'
  if (operation?.startsWith('cache')) return 'bg-success'
  return 'bg-primary'
}

function failed(status?: string | null, statusCode?: number | null) {
  return (statusCode || 0) >= 500 || ['internal_error', 'unknown_error', 'deadline_exceeded', 'unavailable'].includes(status || '')
}
</script>

<template>
  <UDashboardPanel id="performance-detail">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'gap-2' }">
        <template #leading>
          <AppNavbarLeading
            :back-to="data ? `/projects/${data.project.id}/performance` : '/'"
            back-label="Back to performance"
          />
        </template>
        <template #default>
          <div class="flex min-w-0 items-center gap-2">
            <span class="shrink-0 text-xs text-dimmed">{{ data?.project.name }}</span>
            <span class="shrink-0 text-dimmed">/</span>
            <code class="truncate font-mono text-xs text-muted">{{ data?.transaction.name || 'Request' }}</code>
          </div>
        </template>
        <template #right>
          <UBadge
            v-if="data"
            :color="failed(data.transaction.status, data.transaction.statusCode) ? 'error' : 'success'"
            variant="subtle"
            size="sm"
          >
            {{ data.transaction.statusCode || data.transaction.status || 'ok' }}
          </UBadge>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="status === 'pending'"
        class="mx-auto w-full max-w-[110rem] space-y-3"
      >
        <USkeleton class="h-48 rounded-lg" />
        <USkeleton class="h-96 rounded-lg" />
      </div>
      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not load request"
        :description="error.statusMessage || error.message"
      />
      <div
        v-else-if="data"
        class="mx-auto w-full max-w-[110rem] space-y-3 pb-10"
      >
        <header class="overflow-hidden rounded-lg border border-default bg-elevated/20">
          <div
            class="border-l-2 px-4 py-3"
            :class="failed(data.transaction.status, data.transaction.statusCode) ? 'border-error' : 'border-success'"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{{ data.transaction.method || 'TRACE' }}</span>
              <code class="text-sm text-muted">{{ data.transaction.operation || 'transaction' }}</code>
              <span class="ml-auto font-mono text-[11px] text-dimmed">{{ data.transaction.eventId }}</span>
              <CopyButton
                :value="data.transaction.eventId"
                aria-label="Copy event id"
              />
            </div>
            <h1 class="mt-2 break-words font-mono text-lg font-semibold leading-snug text-highlighted sm:text-xl">
              {{ data.transaction.name }}
            </h1>
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
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 border-t border-default bg-elevated/40 px-4 py-2">
            <span
              v-for="item in ribbon"
              :key="item.label"
              class="flex min-w-0 items-baseline gap-1.5 text-[11px]"
            >
              <span class="shrink-0 text-dimmed">{{ item.label }}</span>
              <span
                class="max-w-80 truncate font-mono text-muted"
                :title="String(item.value)"
              >{{ item.value }}</span>
            </span>
          </div>
        </header>

        <nav class="-mx-1 flex gap-1 overflow-x-auto px-1 pb-px">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="activeTab === tab.value ? 'border-primary/40 bg-primary/10 text-primary' : 'border-transparent text-muted hover:bg-elevated/60 hover:text-highlighted'"
            @click="activeTab = tab.value"
          >
            <UIcon
              :name="tab.icon"
              class="size-3.5"
            />{{ tab.label }}
            <span
              v-if="tab.value === 'spans' && data.spans.length"
              class="rounded bg-accented/60 px-1 font-mono text-[10px] tabular-nums text-dimmed"
            >{{ data.spans.length }}</span>
          </button>
        </nav>

        <div
          v-if="activeTab === 'spans'"
          class="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]"
        >
          <section class="overflow-hidden rounded-lg border border-default">
            <div class="grid grid-cols-[8rem_minmax(0,1fr)_5rem] gap-3 border-b border-default bg-elevated/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-dimmed">
              <span>Operation</span><span>Waterfall</span><span class="text-right">Duration</span>
            </div>
            <UEmpty
              v-if="!data.spans.length"
              icon="i-lucide-gantt-chart"
              title="No child spans captured"
              description="This request has a total duration, but its internal database, HTTP, and application work was not instrumented."
              class="py-16"
            />
            <button
              v-for="span in data.spans"
              v-else
              :key="span.id"
              type="button"
              class="grid w-full grid-cols-[8rem_minmax(0,1fr)_5rem] items-center gap-3 border-b border-default px-3 py-2 text-left last:border-b-0 hover:bg-elevated/40"
              :class="selectedSpanId === span.id ? 'bg-primary/5' : ''"
              @click="selectedSpanId = span.id"
            >
              <span class="min-w-0">
                <code class="block truncate font-mono text-[11px] font-semibold text-highlighted">{{ span.operation || 'span' }}</code>
                <span
                  class="block truncate text-[10px] text-dimmed"
                  :title="span.description || undefined"
                >{{ span.description || 'unnamed operation' }}</span>
              </span>
              <span class="relative h-5 rounded bg-accented/30">
                <span
                  class="absolute top-1 h-3 min-w-px rounded-sm opacity-80"
                  :class="operationTone(span.operation)"
                  :style="spanStyle(span)"
                />
              </span>
              <span
                class="text-right font-mono text-xs tabular-nums"
                :class="span.durationMs > data.stats.p95Ms ? 'text-warning' : 'text-muted'"
              >{{ formatDuration(span.durationMs) }}</span>
            </button>
          </section>
          <AppPanel
            :title="selectedSpan ? selectedSpan.operation || 'Span details' : 'Why was it slow?'"
            :hint="selectedSpan ? formatDuration(selectedSpan.durationMs) : 'select a span'"
          >
            <template v-if="selectedSpan">
              <DataList
                :items="[
                  ['description', selectedSpan.description],
                  ['status', selectedSpan.status],
                  ['span id', selectedSpan.spanId],
                  ['parent span', selectedSpan.parentSpanId],
                  ['started', formatAbsolute(selectedSpan.startTimestamp)]
                ]"
              />
              <JsonTree
                v-if="selectedSpan.data"
                class="mt-3"
                name="data"
                :value="selectedSpan.data"
              />
            </template>
            <p
              v-else
              class="text-xs leading-5 text-muted"
            >
              The longest database, outgoing HTTP, cache, and application spans usually reveal where request time is being spent.
            </p>
          </AppPanel>
        </div>
        <IssueRequest
          v-else-if="activeTab === 'request'"
          :request="data.transaction.request || {}"
          :contexts="data.transaction.contexts || {}"
        />
        <IssueContexts
          v-else-if="activeTab === 'context'"
          :contexts="data.transaction.contexts || {}"
          :user="data.transaction.user || {}"
          :payload="data.transaction.rawPayload || {}"
        />
        <IssueRaw
          v-else
          :payload="data.transaction.rawPayload || {}"
          :event-id="data.transaction.eventId"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
