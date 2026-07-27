<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  icon?: string
  hint?: string
  count?: number | string
  padded?: boolean
}>(), {
  padded: true
})
</script>

<template>
  <section class="min-w-0 overflow-hidden rounded-lg border border-default bg-elevated/20">
    <header
      v-if="title || $slots.actions"
      class="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 border-b border-default bg-elevated/40 px-3 py-1.5"
    >
      <UIcon
        v-if="icon"
        :name="icon"
        class="size-3.5 shrink-0 text-dimmed"
      />
      <h2 class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {{ title }}
      </h2>
      <span
        v-if="count !== undefined"
        class="rounded bg-accented/60 px-1.5 py-px font-mono text-[10px] tabular-nums text-muted"
      >{{ count }}</span>
      <span
        v-if="hint"
        class="truncate text-[11px] text-dimmed"
      >{{ hint }}</span>
      <div class="ml-auto flex items-center gap-1">
        <slot name="actions" />
      </div>
    </header>
    <div :class="padded ? 'px-3 py-2.5' : ''">
      <slot />
    </div>
  </section>
</template>
