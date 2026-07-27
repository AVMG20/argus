<script setup lang="ts">
import type { StoredEvent, UnknownRecord } from '~/utils/sentry'

const props = defineProps<{
  event: StoredEvent
  payload: UnknownRecord
  projectId: string
  fingerprint: string
}>()

const tagEntries = computed(() => recordEntries(props.event.tags))
const extra = computed(() => (isRecord(props.payload.extra) ? props.payload.extra : {}) as UnknownRecord)
const modules = computed(() => recordEntries(props.payload.modules))
const sdk = computed(() => (isRecord(props.payload.sdk) ? props.payload.sdk : {}) as UnknownRecord)
const integrations = computed(() => Array.isArray(sdk.value.integrations) ? sdk.value.integrations.map(String) : [])
const packages = computed(() => Array.isArray(sdk.value.packages) ? sdk.value.packages as UnknownRecord[] : [])
const debugImages = computed(() => {
  const meta = isRecord(props.payload.debug_meta) ? props.payload.debug_meta : {}
  return Array.isArray(meta.images) ? meta.images as UnknownRecord[] : []
})

const groupingFingerprint = computed(() => Array.isArray(props.payload.fingerprint) ? props.payload.fingerprint.join(' · ') : '')

const eventFields = computed<Array<[string, unknown]>>(() => ([
  ['event id', props.event.eventId],
  ['platform', props.payload.platform],
  ['level', props.payload.level],
  ['logger', props.payload.logger],
  ['transaction', props.event.transaction],
  ['environment', props.event.environment],
  ['release', props.event.release],
  ['dist', props.payload.dist],
  ['server name', props.event.serverName],
  ['grouping fingerprint', groupingFingerprint.value || `auto (${props.fingerprint})`],
  ['sdk', [sdk.value.name, sdk.value.version].filter(Boolean).join(' ')]
] as Array<[string, unknown]>).filter(([, value]) => value !== undefined && value !== null && value !== ''))

function tagSearchLink(key: string, value: unknown) {
  return `/projects/${props.projectId}?q=${encodeURIComponent(`${key}:${String(value)}`)}`
}
</script>

<template>
  <div class="space-y-3">
    <AppPanel
      title="Tags"
      icon="i-lucide-tags"
      :count="tagEntries.length"
      hint="indexed dimensions — click to search the project"
    >
      <div
        v-if="tagEntries.length"
        class="flex flex-wrap gap-1.5"
      >
        <NuxtLink
          v-for="[key, value] in tagEntries"
          :key="key"
          :to="tagSearchLink(key, value)"
          class="group flex max-w-full items-center gap-1 rounded border border-default bg-default px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:border-primary/50 hover:bg-primary/5"
        >
          <span class="text-dimmed">{{ key }}</span>
          <span class="truncate text-highlighted group-hover:text-primary">{{ inlineValue(value, 48) }}</span>
        </NuxtLink>
      </div>
      <p
        v-else
        class="text-xs text-dimmed"
      >
        No tags captured. Use <code class="font-mono">Sentry.setTag()</code> to add searchable dimensions.
      </p>
    </AppPanel>

    <div class="grid gap-3 xl:grid-cols-2">
      <AppPanel
        title="Additional data"
        icon="i-lucide-package-open"
        :count="recordEntries(extra).length"
        hint="Sentry.setExtra()"
      >
        <DataList
          :data="extra"
          searchable
          key-width="9rem"
          empty="No extra data captured."
        />
      </AppPanel>

      <AppPanel
        title="Event fields"
        icon="i-lucide-hash"
      >
        <DataList
          :entries="eventFields"
          key-width="9rem"
        />
      </AppPanel>

      <AppPanel
        v-if="integrations.length || packages.length || recordEntries(sdk).length"
        title="SDK"
        icon="i-lucide-plug"
        :hint="[sdk.name, sdk.version].filter(Boolean).join(' ')"
      >
        <div
          v-if="integrations.length"
          class="mb-2"
        >
          <p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-dimmed">
            Active integrations ({{ integrations.length }})
          </p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="integration in integrations"
              :key="integration"
              class="rounded bg-accented/50 px-1.5 py-0.5 font-mono text-[10px] text-muted"
            >{{ integration }}</span>
          </div>
        </div>
        <DataList
          v-if="packages.length"
          :entries="packages.map(item => [String(item.name), item.version])"
          key-width="12rem"
        />
      </AppPanel>

      <AppPanel
        v-if="modules.length"
        title="Modules"
        icon="i-lucide-boxes"
        :count="modules.length"
      >
        <DataList
          :entries="modules"
          searchable
          key-width="14rem"
        />
      </AppPanel>

      <AppPanel
        v-if="debugImages.length"
        title="Debug images"
        icon="i-lucide-file-search"
        :count="debugImages.length"
        hint="source map lookup ids"
        class="xl:col-span-2"
      >
        <DataList
          v-for="(image, index) in debugImages"
          :key="index"
          :data="image"
          key-width="10rem"
          class="border-b border-default/60 py-1 last:border-b-0"
        />
      </AppPanel>
    </div>
  </div>
</template>
