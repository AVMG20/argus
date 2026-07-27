<script setup lang="ts">
type Entry = { key: string, value: string, count: number }

const props = defineProps<{
  distribution: Entry[]
  projectId: string
}>()

const priority = ['browser', 'os', 'device', 'runtime', 'release', 'environment', 'url', 'transaction', 'user', 'level', 'server', 'sdk', 'browser version']
const expanded = ref(new Set<string>())

const groups = computed(() => {
  const grouped = new Map<string, Entry[]>()
  for (const entry of props.distribution) {
    grouped.set(entry.key, [...(grouped.get(entry.key) || []), entry])
  }
  return [...grouped]
    .map(([key, values]) => ({
      key,
      label: key.startsWith('tag:') ? key.slice(4) : key,
      isTag: key.startsWith('tag:'),
      total: values.reduce((sum, item) => sum + item.count, 0),
      values: values.slice().sort((a, b) => b.count - a.count)
    }))
    .sort((a, b) => {
      const rankA = priority.indexOf(a.key)
      const rankB = priority.indexOf(b.key)
      if (rankA !== rankB) return (rankA < 0 ? 99 : rankA) - (rankB < 0 ? 99 : rankB)
      return a.label.localeCompare(b.label)
    })
})

function visibleValues(group: { key: string, values: Entry[] }) {
  return expanded.value.has(group.key) ? group.values : group.values.slice(0, 4)
}

function toggle(key: string) {
  const next = new Set(expanded.value)
  if (!next.delete(key)) next.add(key)
  expanded.value = next
}

function percent(count: number, total: number) {
  return total ? Math.round((count / total) * 100) : 0
}

function searchLink(group: { label: string, isTag: boolean }, value: string) {
  return `/projects/${props.projectId}?q=${encodeURIComponent(group.isTag ? `${group.label}:${value}` : value)}`
}
</script>

<template>
  <AppPanel
    title="Breakdown"
    icon="i-lucide-chart-bar"
    hint="across all stored events"
  >
    <p
      v-if="!groups.length"
      class="text-xs text-dimmed"
    >
      No dimensions captured yet.
    </p>

    <div
      v-else
      class="space-y-3"
    >
      <div
        v-for="group in groups"
        :key="group.key"
      >
        <div class="mb-1 flex items-baseline gap-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">{{ group.label }}</span>
          <span
            v-if="group.isTag"
            class="rounded bg-accented/50 px-1 font-mono text-[9px] text-dimmed"
          >tag</span>
          <span class="ml-auto font-mono text-[10px] text-dimmed">{{ group.values.length }}</span>
        </div>

        <div class="space-y-0.5">
          <NuxtLink
            v-for="entry in visibleValues(group)"
            :key="entry.value"
            :to="searchLink(group, entry.value)"
            class="group relative block overflow-hidden rounded px-1.5 py-0.5 hover:bg-elevated/60"
            :title="`${entry.value} — ${entry.count} of ${group.total}`"
          >
            <span
              class="absolute inset-y-0 left-0 bg-primary/15 transition-colors group-hover:bg-primary/25"
              :style="{ width: `${percent(entry.count, group.total)}%` }"
            />
            <span class="relative flex items-baseline gap-2">
              <span class="min-w-0 flex-1 truncate font-mono text-[11px] text-highlighted">{{ entry.value }}</span>
              <span class="shrink-0 font-mono text-[10px] tabular-nums text-dimmed">{{ percent(entry.count, group.total) }}%</span>
            </span>
          </NuxtLink>
        </div>

        <button
          v-if="group.values.length > 4"
          type="button"
          class="mt-0.5 px-1.5 text-[10px] text-dimmed transition-colors hover:text-muted"
          @click="toggle(group.key)"
        >
          {{ expanded.has(group.key) ? 'Show less' : `Show ${group.values.length - 4} more` }}
        </button>
      </div>
    </div>
  </AppPanel>
</template>
