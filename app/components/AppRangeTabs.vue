<script setup lang="ts" generic="T extends string">
defineProps<{
  items: ReadonlyArray<{ label: string, value: T }>
  ariaLabel?: string
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div
    class="flex shrink-0 items-center gap-px rounded-md bg-elevated/60 p-px"
    role="group"
    :aria-label="ariaLabel"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="rounded-[5px] px-1.5 py-0.5 font-mono text-[10px] transition-colors"
      :class="model === item.value
        ? 'bg-accented text-highlighted'
        : 'text-dimmed hover:text-muted'"
      :aria-pressed="model === item.value"
      @click="model = item.value"
    >
      {{ item.label }}
    </button>
  </div>
</template>
