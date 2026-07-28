<script setup lang="ts">
import type { TraceGroup, TraceNode, TraceRootLike, TraceSpanLike } from '~/utils/trace'

const props = defineProps<{
  transaction: TraceRootLike
  spans: TraceSpanLike[]
  p95Ms?: number
}>()

type Sort = 'timeline' | 'duration' | 'self' | 'calls'

const sortItems: Array<{ label: string, value: Sort, icon: string }> = [
  { label: 'Timeline', value: 'timeline', icon: 'i-lucide-align-left' },
  { label: 'Longest', value: 'duration', icon: 'i-lucide-arrow-down-wide-narrow' },
  { label: 'Most self time', value: 'self', icon: 'i-lucide-timer' },
  { label: 'Most calls', value: 'calls', icon: 'i-lucide-repeat' }
]

const sort = ref<Sort>('timeline')
const grouped = ref(false)
const query = ref('')
const selectedId = ref<string>()

// Timeline means the tree, and counting calls means collapsing them; the two controls
// stay consistent so picking Timeline always lands back on the waterfall.
watch(sort, (value) => {
  if (value === 'calls') grouped.value = true
  if (value === 'timeline') grouped.value = false
})
watch(grouped, (value) => {
  if (!value && sort.value === 'calls') sort.value = 'duration'
  if (value && sort.value === 'timeline') sort.value = 'duration'
})

const totalMs = computed(() => Math.max(1, props.transaction.durationMs))
const nodes = computed(() => buildTrace(props.spans, props.transaction))
const spanNodes = computed(() => nodes.value.filter(node => !node.isRoot))
const traceStart = computed(() => nodes.value[0]?.startMs || 0)

function matches(text: string) {
  const needle = query.value.trim().toLowerCase()
  return !needle || text.toLowerCase().includes(needle)
}

const rows = computed(() => {
  const visible = nodes.value.filter(node => node.isRoot || matches(`${node.operation} ${node.description}`))
  if (sort.value === 'timeline') return visible
  return visible
    .filter(node => !node.isRoot)
    .sort((a, b) => (sort.value === 'self' ? b.selfMs - a.selfMs : b.durationMs - a.durationMs))
})

const groups = computed(() => {
  const all = groupTrace(spanNodes.value).filter(group => matches(`${group.operation} ${group.description}`))
  return all.sort((a, b) => {
    if (sort.value === 'calls') return b.calls - a.calls || b.totalMs - a.totalMs
    if (sort.value === 'self') return b.selfMs - a.selfMs
    if (sort.value === 'duration') return b.totalMs - a.totalMs
    return a.firstIndex - b.firstIndex
  })
})

const breakdown = computed(() => summarizeCategories(spanNodes.value, totalMs.value))
/** Concurrent spans make the self times sum past the request duration; say so rather than lying with the bars. */
const overlapping = computed(() => spanNodes.value.reduce((total, node) => total + node.selfMs, 0) > totalMs.value * 1.05)
const repeated = computed(() => groupTrace(spanNodes.value)
  .filter(group => group.calls > 2)
  .sort((a, b) => b.calls - a.calls || b.totalMs - a.totalMs)
  .slice(0, 5))

const selected = computed(() => spanNodes.value.find(node => node.id === selectedId.value))
const selectedGroup = computed(() => {
  const node = selected.value
  return node ? groupTrace(spanNodes.value).find(group => group.signature === node.signature) : undefined
})
const hiddenCount = computed(() => (grouped.value ? 0 : spanNodes.value.length - rows.value.filter(row => !row.isRoot).length))

/** Slow enough to be worth a second look: at or above the endpoint p95, or a fifth of the request. */
function isHot(ms: number) {
  return ms >= Math.max(props.p95Ms || 0, totalMs.value * 0.2)
}

function share(ms: number) {
  return (ms / totalMs.value) * 100
}

function timelineStyle(node: TraceNode) {
  const left = Math.max(0, Math.min(99.5, ((node.startMs - traceStart.value) / totalMs.value) * 100))
  return { left: `${left}%`, width: `${Math.max(0.4, Math.min(100 - left, share(node.durationMs)))}%` }
}

function segmentStyle([from, to]: [number, number]) {
  const left = Math.max(0, Math.min(99.5, ((from - traceStart.value) / totalMs.value) * 100))
  return { left: `${left}%`, width: `${Math.max(0.4, Math.min(100 - left, share(to - from)))}%` }
}

function barStyle(ms: number) {
  return { left: '0%', width: `${Math.max(0.4, Math.min(100, share(ms)))}%` }
}

function select(node: TraceNode) {
  selectedId.value = node.isRoot || selectedId.value === node.id ? undefined : node.id
}

/** A group row stands for many spans; the slowest one is the useful example. */
function selectGroup(group: TraceGroup) {
  selectedId.value = selectedId.value === group.slowest.id ? undefined : group.slowest.id
}
</script>

<template>
  <div class="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <section class="min-w-0 overflow-hidden rounded-lg border border-default">
      <div class="flex flex-wrap items-center gap-2 border-b border-default bg-elevated/40 px-3 py-2">
        <UInput
          v-model="query"
          icon="i-lucide-search"
          size="xs"
          variant="soft"
          placeholder="Filter spans…"
          class="w-44"
        />
        <USelect
          v-model="sort"
          :items="sortItems"
          size="xs"
          variant="soft"
          icon="i-lucide-arrow-up-down"
          class="w-40"
        />
        <UButton
          size="xs"
          icon="i-lucide-layers"
          :color="grouped ? 'primary' : 'neutral'"
          :variant="grouped ? 'soft' : 'ghost'"
          :aria-pressed="grouped"
          @click="grouped = !grouped"
        >
          Group calls
        </UButton>
        <p class="ml-auto hidden text-[10px] text-dimmed lg:block">
          solid = own work · faded = time inside child spans
        </p>
      </div>

      <div
        v-if="grouped"
        class="grid grid-cols-[minmax(0,1fr)_5rem] gap-3 border-b border-default bg-elevated/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-dimmed sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_4rem_5rem]"
      >
        <span>Call site</span>
        <span class="hidden sm:block">Share of request</span>
        <span class="hidden text-right sm:block">Calls</span>
        <span class="text-right">Total</span>
      </div>
      <div
        v-else
        class="grid grid-cols-[minmax(0,1fr)_5rem] gap-3 border-b border-default bg-elevated/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-dimmed sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_4rem_5rem]"
      >
        <span>Operation</span>
        <span class="hidden sm:block">{{ sort === 'timeline' ? 'Waterfall' : 'Share of request' }}</span>
        <span class="hidden text-right sm:block">Self</span>
        <span class="text-right">Total</span>
      </div>

      <UEmpty
        v-if="!spans.length"
        icon="i-lucide-gantt-chart"
        title="No child spans captured"
        description="This request has a total duration, but its internal database, HTTP, and application work was not instrumented."
        class="py-16"
      />
      <UEmpty
        v-else-if="grouped ? !groups.length : !rows.length"
        icon="i-lucide-search-x"
        title="No spans match this filter"
        :description="`Nothing in this trace matches “${query}”.`"
        class="py-12"
      />

      <template v-else-if="grouped">
        <button
          v-for="group in groups"
          :key="group.signature"
          type="button"
          class="grid w-full grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 border-b border-default px-3 py-2 text-left last:border-b-0 hover:bg-elevated/40 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_4rem_5rem]"
          :class="selectedId === group.slowest.id ? 'bg-primary/5' : ''"
          @click="selectGroup(group)"
        >
          <span class="flex min-w-0 items-center gap-2">
            <span
              class="shrink-0 rounded px-1 py-px font-mono text-[10px] font-semibold uppercase"
              :class="group.category.badge"
            >{{ group.category.label }}</span>
            <span class="min-w-0">
              <span
                class="block truncate font-mono text-[11px] text-highlighted"
                :title="group.description || group.operation"
              >{{ group.description || group.operation }}</span>
              <span class="block truncate text-[10px] text-dimmed">
                avg {{ formatDuration(group.averageMs) }} · max {{ formatDuration(group.maxMs) }}
                <template v-if="operationDetail(group.operation)"> · {{ operationDetail(group.operation) }}</template>
              </span>
            </span>
          </span>
          <span class="relative hidden h-5 rounded bg-accented/25 sm:block">
            <span
              class="absolute top-1 h-3 min-w-px rounded-sm opacity-40"
              :class="group.category.bar"
              :style="barStyle(group.totalMs)"
            />
            <span
              class="absolute top-1 h-3 min-w-px rounded-sm"
              :class="group.category.bar"
              :style="barStyle(group.selfMs)"
            />
          </span>
          <span
            class="hidden text-right font-mono text-xs tabular-nums sm:block"
            :class="group.calls > 4 ? 'text-warning' : 'text-muted'"
          >{{ group.calls }}×</span>
          <span
            class="text-right font-mono text-xs tabular-nums"
            :class="isHot(group.totalMs) ? 'text-warning' : 'text-muted'"
          >{{ formatDuration(group.totalMs) }}</span>
        </button>
      </template>

      <template v-else>
        <button
          v-for="node in rows"
          :key="node.id"
          type="button"
          class="grid w-full grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 border-b border-default px-3 py-2 text-left last:border-b-0 hover:bg-elevated/40 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_4rem_5rem]"
          :class="[selectedId === node.id ? 'bg-primary/5' : '', node.isRoot ? 'bg-elevated/30' : '']"
          @click="select(node)"
        >
          <span class="flex min-w-0 items-center gap-2">
            <span
              v-if="sort === 'timeline'"
              class="flex shrink-0 self-stretch"
              aria-hidden="true"
            >
              <span
                v-for="level in node.depth"
                :key="level"
                class="ml-1 w-2 border-l border-default"
              />
            </span>
            <span
              class="shrink-0 rounded px-1 py-px font-mono text-[10px] font-semibold uppercase"
              :class="node.isRoot ? 'bg-accented/60 text-muted' : node.category.badge"
            >{{ node.isRoot ? 'root' : node.category.label }}</span>
            <span class="min-w-0">
              <span class="flex min-w-0 items-center gap-1.5">
                <span
                  class="truncate font-mono text-[11px] text-highlighted"
                  :title="node.description || node.operation"
                >{{ node.description || node.operation }}</span>
                <span
                  v-if="node.repeats > 1"
                  class="shrink-0 rounded bg-accented/60 px-1 font-mono text-[10px] tabular-nums text-dimmed"
                  :title="`This call site runs ${node.repeats} times in this trace`"
                >{{ node.repeats }}×</span>
              </span>
              <span class="block truncate text-[10px] text-dimmed">
                <template v-if="sort !== 'timeline' && node.parentLabel">in {{ node.parentLabel }} · </template>
                {{ operationDetail(node.operation) || node.operation }}
              </span>
            </span>
          </span>
          <span class="relative hidden h-5 rounded bg-accented/25 sm:block">
            <template v-if="sort === 'timeline'">
              <span
                class="absolute top-1 h-3 min-w-px rounded-sm opacity-30"
                :class="node.category.bar"
                :style="timelineStyle(node)"
              />
              <span
                v-for="segment in node.selfSegments"
                :key="segment[0]"
                class="absolute top-1 h-3 min-w-px rounded-sm"
                :class="node.category.bar"
                :style="segmentStyle(segment)"
              />
            </template>
            <template v-else>
              <span
                class="absolute top-1 h-3 min-w-px rounded-sm opacity-30"
                :class="node.category.bar"
                :style="barStyle(node.durationMs)"
              />
              <span
                class="absolute top-1 h-3 min-w-px rounded-sm"
                :class="node.category.bar"
                :style="barStyle(node.selfMs)"
              />
            </template>
          </span>
          <span
            class="hidden text-right font-mono text-xs tabular-nums sm:block"
            :class="node.selfMs >= node.durationMs * 0.6 ? 'text-highlighted' : 'text-dimmed'"
          >{{ formatDuration(node.selfMs) }}</span>
          <span
            class="text-right font-mono text-xs tabular-nums"
            :class="isHot(node.durationMs) ? 'text-warning' : 'text-muted'"
          >{{ formatDuration(node.durationMs) }}</span>
        </button>
      </template>

      <p
        v-if="hiddenCount > 0"
        class="border-t border-default px-3 py-1.5 text-[10px] text-dimmed"
      >
        {{ hiddenCount }} span{{ hiddenCount === 1 ? '' : 's' }} hidden by the filter.
      </p>
    </section>

    <div class="min-w-0 space-y-3">
      <AppPanel
        v-if="selected"
        :title="selected.category.label + ' span'"
        :icon="selected.category.icon"
        :hint="`${formatDuration(selected.durationMs)} · ${share(selected.durationMs).toFixed(0)}% of request`"
      >
        <template #actions>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Clear selection"
            @click="selectedId = undefined"
          />
        </template>
        <p class="break-words font-mono text-xs leading-5 text-highlighted">
          {{ selected.description || selected.operation }}
        </p>
        <DataList
          class="mt-2"
          :entries="[
            ['operation', selected.operation],
            ['self time', `${formatDuration(selected.selfMs)} (${share(selected.selfMs).toFixed(0)}% of request)`],
            ['in child spans', formatDuration(selected.durationMs - selected.selfMs)],
            ['child spans', selected.children.length],
            ['calls in trace', selectedGroup ? `${selectedGroup.calls} × · ${formatDuration(selectedGroup.totalMs)} total` : '1 ×'],
            ['starts at', `+${formatDuration(selected.startMs - traceStart)}`],
            ['status', selected.status],
            ['span id', selected.span?.spanId],
            ['parent span', selected.span?.parentSpanId]
          ]"
          key-width="8rem"
        />
        <JsonTree
          v-if="selected.span?.data"
          class="mt-3"
          name="data"
          :value="selected.span.data"
        />
        <JsonTree
          v-if="selected.span?.tags"
          class="mt-2"
          name="tags"
          :value="selected.span.tags"
        />
      </AppPanel>

      <AppPanel
        title="Where time went"
        icon="i-lucide-pie-chart"
        :hint="overlapping ? 'self time · spans overlap' : 'self time'"
      >
        <ul class="space-y-2">
          <li
            v-for="entry in breakdown"
            :key="entry.category.key"
          >
            <div class="flex items-baseline justify-between gap-2 text-[11px]">
              <span class="truncate text-muted">
                {{ entry.category.label }}
                <span
                  v-if="entry.calls"
                  class="text-dimmed"
                >· {{ entry.calls }} span{{ entry.calls === 1 ? '' : 's' }}</span>
              </span>
              <span class="shrink-0 font-mono tabular-nums text-highlighted">{{ formatDuration(entry.selfMs) }}</span>
            </div>
            <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-accented/30">
              <div
                class="h-full rounded-full"
                :class="entry.category.bar"
                :style="{ width: `${Math.max(1, entry.share)}%` }"
              />
            </div>
          </li>
        </ul>
        <p
          v-if="!spans.length"
          class="text-xs text-dimmed"
        >
          Nothing was instrumented inside this request.
        </p>
      </AppPanel>

      <AppPanel
        v-if="repeated.length"
        title="Repeated calls"
        icon="i-lucide-repeat"
        hint="same call site, run more than twice"
      >
        <ul class="divide-y divide-default/60">
          <li
            v-for="group in repeated"
            :key="group.signature"
          >
            <button
              type="button"
              class="flex w-full items-baseline gap-2 py-1.5 text-left hover:text-highlighted"
              @click="selectGroup(group)"
            >
              <span
                class="shrink-0 font-mono text-[11px] tabular-nums"
                :class="group.calls > 4 ? 'text-warning' : 'text-muted'"
              >{{ group.calls }}×</span>
              <span
                class="min-w-0 flex-1 truncate font-mono text-[11px] text-muted"
                :title="group.description || group.operation"
              >{{ group.description || group.operation }}</span>
              <span class="shrink-0 font-mono text-[11px] tabular-nums text-dimmed">{{ formatDuration(group.totalMs) }}</span>
            </button>
          </li>
        </ul>
      </AppPanel>
    </div>
  </div>
</template>
