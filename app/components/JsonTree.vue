<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: unknown
  name?: string
  depth?: number
  openDepth?: number
}>(), {
  depth: 0,
  openDepth: 1
})

const open = ref(props.depth < props.openDepth)

const isBranch = computed(() => props.value !== null && typeof props.value === 'object')
const entries = computed<Array<[string, unknown]>>(() => {
  if (Array.isArray(props.value)) return props.value.map((item, index) => [String(index), item])
  if (isBranch.value) return Object.entries(props.value as Record<string, unknown>)
  return []
})

const summary = computed(() => {
  if (!isBranch.value) return ''
  return Array.isArray(props.value) ? `[${entries.value.length}]` : `{${entries.value.length}}`
})

const leafClass = computed(() => {
  if (props.value === null || props.value === undefined) return 'text-dimmed'
  if (typeof props.value === 'string') return 'text-success'
  if (typeof props.value === 'number') return 'text-info'
  if (typeof props.value === 'boolean') return 'text-warning'
  return 'text-highlighted'
})

const leafText = computed(() => typeof props.value === 'string' ? `"${props.value}"` : String(props.value))
</script>

<template>
  <div class="font-mono text-[11.5px] leading-[1.7]">
    <div
      v-if="isBranch"
      class="min-w-0"
    >
      <button
        type="button"
        class="group flex w-full min-w-0 items-center gap-1 rounded px-1 text-left hover:bg-elevated/60"
        @click="open = !open"
      >
        <UIcon
          name="i-lucide-chevron-right"
          class="size-3 shrink-0 text-dimmed transition-transform"
          :class="open ? 'rotate-90' : ''"
        />
        <span
          v-if="name"
          class="text-muted"
        >{{ name }}</span>
        <span class="text-dimmed">{{ summary }}</span>
        <span
          v-if="!open && entries.length"
          class="min-w-0 truncate text-dimmed/70"
        >{{ entries.slice(0, 6).map(([key]) => key).join(', ') }}</span>
      </button>
      <div
        v-if="open"
        class="ml-2 border-l border-default/60 pl-2"
      >
        <JsonTree
          v-for="[key, child] in entries"
          :key="key"
          :value="child"
          :name="key"
          :depth="depth + 1"
          :open-depth="openDepth"
        />
      </div>
    </div>

    <div
      v-else
      class="flex min-w-0 gap-1 px-1 pl-[1rem]"
    >
      <span
        v-if="name"
        class="shrink-0 text-muted"
      >{{ name }}:</span>
      <span
        class="min-w-0 whitespace-pre-wrap break-all"
        :class="leafClass"
      >{{ leafText }}</span>
    </div>
  </div>
</template>
