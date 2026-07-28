<script setup lang="ts">
const props = withDefaults(defineProps<{
  data?: unknown
  entries?: Array<[string, unknown]>
  searchable?: boolean
  keyWidth?: string
  empty?: string
}>(), {
  keyWidth: '11rem',
  empty: 'Nothing captured.'
})

const query = ref('')

const allEntries = computed(() => props.entries ?? recordEntries(props.data))
const showSearch = computed(() => props.searchable && allEntries.value.length > 8)
const visibleEntries = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const entries = needle
    ? allEntries.value.filter(([key, value]) => key.toLowerCase().includes(needle) || inlineValue(value, 400).toLowerCase().includes(needle))
    : allEntries.value
  return entries.map(([key, value]) => ({ key, value, human: humanizeValue(key, value) }))
})
</script>

<template>
  <div class="min-w-0">
    <UInput
      v-if="showSearch"
      v-model="query"
      icon="i-lucide-search"
      size="xs"
      variant="soft"
      :placeholder="`Filter ${allEntries.length} entries…`"
      class="mb-2 w-full"
    />
    <dl
      v-if="visibleEntries.length"
      class="divide-y divide-default/60"
    >
      <div
        v-for="entry in visibleEntries"
        :key="entry.key"
        class="group/row grid gap-x-4 py-1.5 sm:grid-cols-[var(--key-width)_minmax(0,1fr)]"
        :style="{ '--key-width': keyWidth }"
      >
        <dt
          class="truncate text-xs text-muted"
          :title="entry.key"
        >
          {{ humanizeKey(entry.key) }}
        </dt>
        <dd class="flex min-w-0 items-start gap-1">
          <span
            v-if="entry.human"
            class="min-w-0 flex-1 text-xs leading-5"
          >
            <span class="font-mono text-highlighted">{{ entry.human.display }}</span>
            <span
              v-if="entry.human.raw"
              class="ml-1.5 break-all font-mono text-[10px] text-dimmed"
            >{{ entry.human.raw }}</span>
          </span>
          <span
            v-else
            class="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs leading-5 text-highlighted"
          >{{ displayValue(entry.value) }}</span>
          <CopyButton
            :value="displayValue(entry.value)"
            class="opacity-0 transition-opacity group-hover/row:opacity-100 focus:opacity-100"
            :aria-label="`Copy ${entry.key}`"
          />
        </dd>
      </div>
    </dl>
    <p
      v-else
      class="py-2 text-xs text-dimmed"
    >
      {{ query ? 'No entries match this filter.' : empty }}
    </p>
  </div>
</template>
