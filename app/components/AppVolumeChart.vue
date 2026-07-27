<script setup lang="ts">
import { BarChart } from 'vue-chrts'

/**
 * Small Unovis bar chart for a bucketed count series. Same look and hover behaviour
 * as the performance charts, sized to sit inside a metric strip. Use AppSparkline
 * instead for per-row sparklines — one Unovis instance per list row is far too heavy.
 */
const props = withDefaults(defineProps<{
  values: number[]
  labels?: string[]
  height?: number
  tone?: 'error' | 'warning' | 'primary' | 'neutral'
  unit?: string
}>(), {
  labels: () => [],
  height: 40,
  tone: 'error',
  unit: 'event'
})

const toneColors = {
  error: 'var(--ui-error)',
  warning: 'var(--ui-warning)',
  primary: 'var(--ui-primary)',
  neutral: 'var(--ui-text-dimmed)'
}

const points = computed(() => props.values.map((value, index) => ({
  label: props.labels[index] || '',
  value
})))
const categories = computed(() => ({ value: { name: 'Events', color: toneColors[props.tone] } }))
// An all-zero series would otherwise collapse the domain onto a single value.
const peak = computed(() => Math.max(1, ...props.values))
const total = computed(() => props.values.reduce((sum, value) => sum + value, 0))

function plural(count: number) {
  return count === 1 ? props.unit : `${props.unit}s`
}
</script>

<template>
  <div
    class="chart-surface w-full"
    :style="{ height: `${height}px` }"
    role="img"
    :aria-label="`${total} ${plural(total)} across ${values.length} buckets`"
  >
    <ClientOnly>
      <BarChart
        :data="points"
        :height="height"
        :categories="categories"
        :y-axis="['value']"
        :y-domain="[0, peak]"
        :padding="{ top: 2, right: 0, bottom: 0, left: 0 }"
        :bar-padding="0.3"
        :radius="1"
        :duration="250"
        :hide-legend="true"
        :hide-x-axis="true"
        :hide-y-axis="true"
        :y-grid-line="false"
      >
        <template #tooltip="{ values: point }">
          <div class="whitespace-nowrap px-2 py-1 text-[11px] leading-tight">
            <span class="font-mono font-semibold text-highlighted">{{ point?.value ?? 0 }}</span>
            <span class="text-muted"> {{ plural(point?.value ?? 0) }}</span>
            <span
              v-if="point?.label"
              class="text-dimmed"
            > · {{ point.label }}</span>
          </div>
        </template>
      </BarChart>
      <template #fallback>
        <div :style="{ height: `${height}px` }" />
      </template>
    </ClientOnly>
  </div>
</template>
