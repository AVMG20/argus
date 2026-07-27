<script setup lang="ts">
const props = defineProps<{
  payload: unknown
  eventId: string
}>()

const mode = ref<'tree' | 'text'>('tree')
const json = computed(() => JSON.stringify(props.payload ?? {}, null, 2))

function download() {
  const blob = new Blob([json.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `argus-event-${props.eventId}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <AppPanel
    title="Raw event payload"
    icon="i-lucide-braces"
    hint="secrets, auth headers, and cookie values are filtered on ingest"
    :padded="false"
  >
    <template #actions>
      <UButton
        :label="mode === 'tree' ? 'Text' : 'Tree'"
        :icon="mode === 'tree' ? 'i-lucide-align-left' : 'i-lucide-list-tree'"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="mode = mode === 'tree' ? 'text' : 'tree'"
      />
      <UButton
        label="Download"
        icon="i-lucide-download"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="download"
      />
      <CopyButton
        :value="json"
        label="Copy"
      />
    </template>

    <div class="max-h-[70vh] overflow-auto p-3">
      <JsonTree
        v-if="mode === 'tree'"
        :value="payload"
        :open-depth="2"
      />
      <pre
        v-else
        class="whitespace-pre-wrap break-all font-mono text-[11.5px] leading-[1.7] text-highlighted"
      >{{ json }}</pre>
    </div>
  </AppPanel>
</template>
