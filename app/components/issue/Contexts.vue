<script setup lang="ts">
import type { UnknownRecord } from '~/utils/sentry'

const props = defineProps<{
  contexts: UnknownRecord
  user: UnknownRecord
  payload: UnknownRecord
}>()

/** `trace` gets its own treatment: the ids are what you paste into a tracing tool. */
const trace = computed(() => (isRecord(props.contexts.trace) ? props.contexts.trace : {}) as UnknownRecord)
const traceId = computed(() => String(trace.value.trace_id || trace.value.traceId || ''))
const spanId = computed(() => String(trace.value.span_id || trace.value.spanId || ''))

const entries = computed(() => Object.entries(props.contexts)
  .filter(([key]) => key !== 'trace')
  .sort(([a], [b]) => a.localeCompare(b)))

const userEntries = computed(() => Object.entries(props.user))
const userLabel = computed(() => affectedUserLabel(props.user))
const geo = computed(() => (isRecord(props.user.geo) ? props.user.geo : {}) as UnknownRecord)

function summary(value: unknown) {
  if (!isRecord(value)) return ''
  return [value.name, value.version].filter(Boolean).join(' ') || String(value.model || value.type || '')
}

/** Device contexts report a capacity and what is left of it; the interesting number is the gap. */
const CAPACITIES: Array<{ label: string, total: string, free: string[] }> = [
  { label: 'Memory', total: 'memory_size', free: ['free_memory', 'usable_memory'] },
  { label: 'Storage', total: 'storage_size', free: ['free_storage'] },
  { label: 'External storage', total: 'external_storage_size', free: ['external_free_storage'] }
]

const device = computed(() => (isRecord(props.contexts.device) ? props.contexts.device : {}) as UnknownRecord)
const deviceMemory = computed(() => {
  const total = Number(device.value.memory_size)
  return Number.isFinite(total) && total > 0 ? total : 0
})

function capacity(label: string, used: number, total: number, note: string) {
  const share = Math.min(100, (used / total) * 100)
  return {
    label,
    used,
    total,
    note,
    share,
    bar: share >= 90 ? 'bg-error' : share >= 75 ? 'bg-warning' : 'bg-primary',
    text: share >= 90 ? 'text-error' : share >= 75 ? 'text-warning' : 'text-highlighted'
  }
}

function usageBars(key: string, value: unknown) {
  if (!isRecord(value)) return []
  // The app context reports what the process holds; the total it is measured against
  // only exists on the device context next to it.
  if (key === 'app') {
    const used = Number(value.app_memory)
    if (!Number.isFinite(used) || used <= 0 || !deviceMemory.value) return []
    return [capacity('App memory', used, deviceMemory.value, `of ${formatBytes(deviceMemory.value)} on the device`)]
  }
  return CAPACITIES.flatMap(({ label, total: totalKey, free: freeKeys }) => {
    const total = Number(value[totalKey])
    const freeKey = freeKeys.find(entry => value[entry] !== undefined && value[entry] !== null)
    const free = Number(freeKey ? value[freeKey] : Number.NaN)
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(free)) return []
    return [capacity(label, Math.min(total, Math.max(0, total - free)), total, `${formatBytes(free)} free`)]
  })
}

/** Ages are measured against the event, not against now — the event may be days old. */
const eventTime = computed(() => toDate(props.payload.timestamp) || new Date())

function cardHint(key: string, value: unknown) {
  if (!isRecord(value)) return summary(value)
  const started = toDate(key === 'app' ? value.app_start_time : key === 'device' ? value.boot_time : undefined)
  if (started) {
    const label = key === 'app' ? 'up' : 'booted'
    return `${label} ${formatElapsed(eventTime.value.getTime() - started.getTime())} at this event`
  }
  return summary(value)
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="traceId || spanId"
      class="rounded-lg border border-default bg-elevated/20 p-3"
    >
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-git-branch"
            class="size-3.5 text-dimmed"
          />
          <span class="text-[11px] uppercase tracking-wider text-dimmed">trace</span>
          <code class="font-mono text-xs text-highlighted">{{ traceId || '—' }}</code>
          <CopyButton
            v-if="traceId"
            :value="traceId"
          />
        </div>
        <div
          v-if="spanId"
          class="flex items-center gap-2"
        >
          <span class="text-[11px] uppercase tracking-wider text-dimmed">span</span>
          <code class="font-mono text-xs text-highlighted">{{ spanId }}</code>
          <CopyButton :value="spanId" />
        </div>
        <div
          v-if="trace.op"
          class="flex items-center gap-2"
        >
          <span class="text-[11px] uppercase tracking-wider text-dimmed">op</span>
          <code class="font-mono text-xs text-highlighted">{{ trace.op }}</code>
        </div>
        <div
          v-if="trace.status"
          class="flex items-center gap-2"
        >
          <span class="text-[11px] uppercase tracking-wider text-dimmed">status</span>
          <code class="font-mono text-xs text-highlighted">{{ trace.status }}</code>
        </div>
      </div>
    </div>

    <div class="grid gap-3 xl:grid-cols-2">
      <AppPanel
        v-if="userEntries.length"
        title="Affected user"
        icon="i-lucide-user-round"
        :hint="userLabel"
      >
        <p class="mb-2 text-[11px] text-dimmed">
          Reported by the SDK for the person using the monitored app — not an Argus teammate.
        </p>
        <DataList
          :entries="userEntries"
          key-width="9rem"
        />
        <DataList
          v-if="hasValues(geo)"
          :data="geo"
          key-width="9rem"
          class="mt-2 border-t border-default/60 pt-2"
        />
      </AppPanel>

      <AppPanel
        v-for="[key, value] in entries"
        :key="key"
        :title="key.replaceAll('_', ' ')"
        :icon="contextIcon(key)"
        :hint="cardHint(key, value)"
      >
        <div
          v-for="bar in usageBars(key, value)"
          :key="bar.label"
          class="mb-2.5 border-b border-default/60 pb-2.5"
        >
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-[11px] text-muted">{{ bar.label }}</span>
            <span
              class="font-mono text-sm font-semibold tabular-nums"
              :class="bar.text"
            >{{ formatBytes(bar.used) }}</span>
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accented/30">
            <div
              class="h-full rounded-full"
              :class="bar.bar"
              :style="{ width: `${Math.max(1, bar.share)}%` }"
            />
          </div>
          <p class="mt-1 text-[10px] text-dimmed">
            {{ bar.share < 1 ? '<1' : Math.round(bar.share) }}% {{ bar.note }}
          </p>
        </div>
        <DataList
          v-if="isRecord(value)"
          :data="value"
          :searchable="recordEntries(value).length > 12"
          key-width="9rem"
        />
        <p
          v-else
          class="whitespace-pre-wrap break-all font-mono text-xs text-highlighted"
        >
          {{ displayValue(value) }}
        </p>
      </AppPanel>
    </div>

    <p
      v-if="!entries.length && !userEntries.length && !traceId"
      class="rounded-lg border border-default bg-elevated/20 px-3 py-8 text-center text-xs text-dimmed"
    >
      No contexts captured. Browser, device, OS, runtime, and trace details appear here once the SDK sends them.
    </p>

    <AppPanel
      v-if="payload.threads"
      title="Threads"
      icon="i-lucide-layers"
    >
      <DataList
        :data="payload.threads"
        key-width="9rem"
      />
    </AppPanel>
  </div>
</template>
