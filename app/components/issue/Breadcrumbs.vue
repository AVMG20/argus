<script setup lang="ts">
import type { UnknownRecord } from '~/utils/sentry'

const props = defineProps<{
  crumbs: UnknownRecord[]
  eventTimestamp?: string
  eventTitle?: string
}>()

const query = ref('')
const levelFilter = ref('all')
const categoryFilter = ref('all')
const newestFirst = ref(false)
const openRows = ref(new Set<number>())

const indexedCrumbs = computed(() => props.crumbs.map((crumb, index) => ({ crumb, index })))

const categories = computed(() => {
  const counts = new Map<string, number>()
  for (const { crumb } of indexedCrumbs.value) {
    const category = String(crumb.category || crumb.type || 'other')
    counts.set(category, (counts.get(category) || 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])
})

const levels = computed(() => {
  const counts = new Map<string, number>()
  for (const { crumb } of indexedCrumbs.value) {
    if (crumb.level) counts.set(String(crumb.level), (counts.get(String(crumb.level)) || 0) + 1)
  }
  return [...counts]
})

const categoryItems = computed(() => [
  { label: `All categories (${props.crumbs.length})`, value: 'all' },
  ...categories.value.map(([category, count]) => ({ label: `${category} (${count})`, value: category }))
])

const levelItems = computed(() => [
  { label: 'All levels', value: 'all' },
  ...levels.value.map(([level, count]) => ({ label: `${level} (${count})`, value: level }))
])

const visibleCrumbs = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const filtered = indexedCrumbs.value.filter(({ crumb }) => {
    if (levelFilter.value !== 'all' && String(crumb.level || '') !== levelFilter.value) return false
    if (categoryFilter.value !== 'all' && String(crumb.category || crumb.type || 'other') !== categoryFilter.value) return false
    if (!needle) return true
    return `${breadcrumbLabel(crumb)} ${crumb.category} ${crumb.type} ${inlineValue(crumb.data, 500)}`.toLowerCase().includes(needle)
  })
  return newestFirst.value ? [...filtered].reverse() : filtered
})

const hasFilters = computed(() => Boolean(query.value) || levelFilter.value !== 'all' || categoryFilter.value !== 'all')

function levelClass(crumb: UnknownRecord) {
  const level = String(crumb.level || '')
  if (level === 'fatal' || level === 'error') return 'text-error'
  if (level === 'warning') return 'text-warning'
  if (level === 'debug') return 'text-dimmed'
  return 'text-muted'
}

function isErrorCrumb(crumb: UnknownRecord) {
  return crumb.level === 'error' || crumb.level === 'fatal' || String(crumb.category || '').startsWith('sentry')
}

function dataPreview(crumb: UnknownRecord) {
  const entries = recordEntries(crumb.data)
  if (!entries.length) return ''
  return entries.slice(0, 4).map(([key, value]) => `${key}=${inlineValue(value, 42)}`).join('  ')
}

function toggleRow(index: number) {
  const next = new Set(openRows.value)
  if (!next.delete(index)) next.add(index)
  openRows.value = next
}

function reset() {
  query.value = ''
  levelFilter.value = 'all'
  categoryFilter.value = 'all'
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <UInput
        v-model="query"
        icon="i-lucide-search"
        size="xs"
        placeholder="Filter breadcrumbs…"
        class="min-w-0 flex-1 sm:max-w-xs"
      />
      <USelect
        v-model="categoryFilter"
        :items="categoryItems"
        size="xs"
        class="w-44"
      />
      <USelect
        v-if="levels.length > 1"
        v-model="levelFilter"
        :items="levelItems"
        size="xs"
        class="w-32"
      />
      <UButton
        v-if="hasFilters"
        label="Reset"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="reset"
      />
      <UButton
        :label="newestFirst ? 'Newest first' : 'Oldest first'"
        :icon="newestFirst ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-narrow-wide'"
        size="xs"
        color="neutral"
        variant="ghost"
        class="ml-auto"
        @click="newestFirst = !newestFirst"
      />
    </div>

    <div class="overflow-hidden rounded-lg border border-default bg-elevated/20">
      <p
        v-if="!crumbs.length"
        class="px-3 py-8 text-center text-xs text-dimmed"
      >
        No breadcrumbs captured. Breadcrumbs record the navigation, requests, clicks, and logs that preceded the error.
      </p>
      <p
        v-else-if="!visibleCrumbs.length"
        class="px-3 py-8 text-center text-xs text-dimmed"
      >
        No breadcrumbs match these filters.
      </p>

      <div
        v-else
        class="divide-y divide-default/60"
      >
        <div
          v-for="{ crumb, index } in visibleCrumbs"
          :key="index"
          class="border-l-2"
          :class="isErrorCrumb(crumb) ? 'border-l-error/70 bg-error/5' : 'border-transparent'"
        >
          <button
            type="button"
            class="grid w-full grid-cols-[3.5rem_1rem_minmax(0,1fr)] items-baseline gap-x-2 py-1.5 pl-2 pr-3 text-left transition-colors hover:bg-elevated/60 sm:grid-cols-[3.5rem_1rem_7rem_minmax(0,1fr)]"
            :disabled="!hasValues(crumb.data)"
            @click="toggleRow(index)"
          >
            <span
              class="shrink-0 text-right font-mono text-[11px] tabular-nums text-dimmed"
              :title="formatAbsolute(crumb.timestamp)"
            >{{ formatOffset(crumb.timestamp, eventTimestamp) || formatAge(crumb.timestamp) }}</span>
            <UIcon
              :name="breadcrumbIcon(crumb)"
              class="size-3.5 shrink-0 self-center"
              :class="levelClass(crumb)"
            />
            <span class="hidden truncate font-mono text-[11px] text-dimmed sm:block">{{ crumb.category || crumb.type || '—' }}</span>
            <span class="min-w-0">
              <span
                class="block truncate text-xs"
                :class="isErrorCrumb(crumb) ? 'font-medium text-error' : 'text-highlighted'"
              >{{ breadcrumbLabel(crumb) }}</span>
              <span
                v-if="dataPreview(crumb) && !openRows.has(index)"
                class="mt-0.5 block truncate font-mono text-[10.5px] text-dimmed"
              >{{ dataPreview(crumb) }}</span>
            </span>
          </button>

          <div
            v-if="openRows.has(index) && hasValues(crumb.data)"
            class="border-t border-default/60 bg-default px-3 py-2 sm:pl-[5rem]"
          >
            <DataList
              :data="crumb.data"
              key-width="9rem"
            />
            <p class="mt-2 font-mono text-[10px] text-dimmed">
              {{ formatAbsolute(crumb.timestamp) }} · level {{ crumb.level || 'info' }} · type {{ crumb.type || 'default' }}
            </p>
          </div>
        </div>

        <div
          v-if="!newestFirst && !hasFilters && eventTimestamp"
          class="flex items-center gap-2 border-l-2 border-error bg-error/10 py-1.5 pl-2 pr-3"
        >
          <span class="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-error">0ms</span>
          <UIcon
            name="i-lucide-circle-x"
            class="size-3.5 shrink-0 text-error"
          />
          <span class="truncate text-xs font-medium text-error">{{ eventTitle || 'Event captured' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
