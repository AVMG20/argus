<script setup lang="ts">
import { useDashboard } from '@nuxt/ui/runtime/utils/dashboard'

defineProps<{
  backTo?: string
  backLabel?: string
}>()

const { sidebarCollapsed } = useDashboard()
</script>

<template>
  <UDashboardSidebarCollapse v-if="sidebarCollapsed" />
  <UButton
    v-else-if="backTo"
    :to="backTo"
    icon="i-lucide-arrow-left"
    color="neutral"
    variant="ghost"
    size="sm"
    :aria-label="backLabel || 'Go back'"
  />
</template>
