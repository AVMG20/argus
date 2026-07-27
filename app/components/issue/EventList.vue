<script setup lang="ts">
import type { StoredEvent } from '~/utils/sentry'

const props = defineProps<{
  events: StoredEvent[]
  selectedId?: string
}>()

const emit = defineEmits<{ select: [id: string] }>()

const position = computed(() => Math.max(0, props.events.findIndex(item => item.id === props.selectedId)))

function summary(event: StoredEvent) {
  const contexts = isRecord(event.contexts) ? event.contexts : {}
  const browser = isRecord(contexts.browser) ? String(contexts.browser.name || '') : ''
  const os = isRecord(contexts.os) ? String(contexts.os.name || '') : ''
  const user = affectedUserLabel(event.user)
  return [browser, os, user].filter(Boolean)
}

function select(offset: number) {
  const next = props.events[position.value + offset]
  if (next) emit('select', next.id)
}
</script>

<template>
  <AppPanel
    title="Events"
    icon="i-lucide-list-ordered"
    :hint="`${position + 1} of ${events.length}`"
    :padded="false"
  >
    <template #actions>
      <UButton
        icon="i-lucide-chevron-up"
        size="xs"
        color="neutral"
        variant="ghost"
        :disabled="position === 0"
        aria-label="Newer event"
        @click="select(-1)"
      />
      <UButton
        icon="i-lucide-chevron-down"
        size="xs"
        color="neutral"
        variant="ghost"
        :disabled="position >= events.length - 1"
        aria-label="Older event"
        @click="select(1)"
      />
    </template>

    <div class="max-h-72 divide-y divide-default/60 overflow-y-auto">
      <button
        v-for="(event, index) in events"
        :key="event.id"
        type="button"
        class="flex w-full items-center gap-2 border-l-2 px-2 py-1.5 text-left transition-colors"
        :class="event.id === selectedId ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-elevated/60'"
        @click="emit('select', event.id)"
      >
        <span class="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-dimmed">{{ formatAge(event.timestamp) }}</span>
        <span class="min-w-0 flex-1">
          <span
            class="block truncate text-[11px]"
            :class="event.id === selectedId ? 'text-highlighted' : 'text-muted'"
          >
            {{ event.environment }}<template v-if="event.release"> · {{ event.release }}</template>
          </span>
          <span class="block truncate font-mono text-[10px] text-dimmed">{{ summary(event).join(' · ') || event.eventId.slice(0, 12) }}</span>
        </span>
        <span class="shrink-0 font-mono text-[10px] text-dimmed">#{{ events.length - index }}</span>
      </button>
    </div>

    <p
      v-if="events.length >= 50"
      class="border-t border-default px-2 py-1 text-[10px] text-dimmed"
    >
      Showing the 50 most recent events.
    </p>
  </AppPanel>
</template>
