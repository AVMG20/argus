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
        :hint="summary(value)"
      >
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
