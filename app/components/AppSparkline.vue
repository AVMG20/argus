<script setup lang="ts">
const props = withDefaults(defineProps<{
  values: number[]
  labels?: string[]
  height?: string
  tone?: 'error' | 'warning' | 'primary' | 'neutral'
}>(), {
  labels: () => [],
  height: 'h-8',
  tone: 'error'
})

const peak = computed(() => Math.max(1, ...props.values))
const total = computed(() => props.values.reduce((sum, value) => sum + value, 0))

const barClass = computed(() => ({
  error: 'bg-error/70 group-hover/spark:bg-error',
  warning: 'bg-warning/70 group-hover/spark:bg-warning',
  primary: 'bg-primary/70 group-hover/spark:bg-primary',
  neutral: 'bg-inverted/40 group-hover/spark:bg-inverted/60'
}[props.tone]))

function barHeight(value: number) {
  if (!value) return '2px'
  return `${Math.max(12, Math.round((value / peak.value) * 100))}%`
}

function barTitle(value: number, index: number) {
  const label = props.labels[index]
  return label ? `${value} ${value === 1 ? 'event' : 'events'} · ${label}` : `${value} ${value === 1 ? 'event' : 'events'}`
}
</script>

<template>
  <div
    class="group/spark flex w-full items-end gap-px"
    :class="height"
    role="img"
    :aria-label="`${total} events across ${values.length} buckets`"
  >
    <span
      v-for="(value, index) in values"
      :key="index"
      class="min-w-px flex-1 rounded-[1px] transition-colors"
      :class="value ? barClass : 'bg-accented/40'"
      :style="{ height: barHeight(value) }"
      :title="barTitle(value, index)"
    />
  </div>
</template>
