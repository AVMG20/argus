<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: string
  label?: string
  size?: 'xs' | 'sm' | 'md'
  variant?: 'ghost' | 'soft' | 'outline'
}>(), {
  size: 'xs',
  variant: 'ghost'
})

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
  } catch {
    return
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => copied.value = false, 1400)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <UButton
    :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
    :label="label"
    :size="size"
    :variant="variant"
    :color="copied ? 'success' : 'neutral'"
    :aria-label="label || 'Copy to clipboard'"
    @click.stop.prevent="copy"
  />
</template>
