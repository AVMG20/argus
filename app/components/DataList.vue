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
  if (!needle) return allEntries.value
  return allEntries.value.filter(([key, value]) => key.toLowerCase().includes(needle) || inlineValue(value, 400).toLowerCase().includes(needle))
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
        v-for="[key, value] in visibleEntries"
        :key="key"
        class="group/row grid gap-x-4 py-1.5 sm:grid-cols-[var(--key-width)_minmax(0,1fr)]"
        :style="{ '--key-width': keyWidth }"
      >
        <dt
          class="truncate text-xs text-muted"
          :title="key"
        >
          {{ humanizeKey(key) }}
        </dt>
        <dd class="flex min-w-0 items-start gap-1">
          <span class="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs leading-5 text-highlighted">{{ displayValue(value) }}</span>
          <CopyButton
            :value="displayValue(value)"
            class="opacity-0 transition-opacity group-hover/row:opacity-100 focus:opacity-100"
            :aria-label="`Copy ${key}`"
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
