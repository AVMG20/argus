<script setup lang="ts">
import type { ProjectSummary } from '../lib/types'

type RequestError = { data?: { message?: string }, statusMessage?: string }

const props = defineProps<{ project: ProjectSummary }>()
const emit = defineEmits<{ changed: [] }>()

const renameOpen = ref(false)
const name = ref(props.project.name)
const renaming = ref(false)
const renameError = ref('')

const health = computed(() => {
  if (props.project.unresolvedCount) {
    return { label: `${formatCount(props.project.unresolvedCount)} unresolved`, color: 'error' as const }
  }
  return props.project.issueCount
    ? { label: 'All resolved', color: 'success' as const }
    : { label: 'No issues', color: 'neutral' as const }
})

const stats = computed(() => {
  const project = props.project
  const items = [
    { label: 'Unresolved', value: formatCount(project.unresolvedCount), tone: project.unresolvedCount ? 'text-error' : 'text-highlighted' },
    { label: 'Events 7d', value: formatCount(project.events7d), tone: 'text-highlighted' },
    { label: 'Users 7d', value: formatCount(project.users7d), tone: 'text-highlighted' }
  ]
  if (project.performance) {
    items.push({ label: 'Avg request', value: formatDuration(project.performance.averageMs), tone: 'text-highlighted' })
  }
  return items
})

// Seven days of six-hour buckets, the same shape the issue list charts use.
const bucketFormatter = new Intl.DateTimeFormat('en', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
const seriesLabels = computed(() => props.project.series.map((_, index) =>
  bucketFormatter.format(new Date(Date.now() - (props.project.series.length - 1 - index) * 6 * 3_600_000))))

function openRename() {
  name.value = props.project.name
  renameError.value = ''
  renameOpen.value = true
}

async function rename() {
  const next = name.value.trim()
  if (!next || renaming.value) return
  renaming.value = true
  renameError.value = ''
  try {
    await $fetch(`/api/projects/${props.project.id}`, { method: 'PATCH', body: { name: next } })
    renameOpen.value = false
    emit('changed')
  } catch (reason: unknown) {
    const requestError = reason as RequestError
    renameError.value = requestError.data?.message || requestError.statusMessage || 'Could not rename the project.'
  } finally {
    renaming.value = false
  }
}
</script>

<template>
  <div class="group relative flex flex-col rounded-lg border border-default bg-elevated/30 p-4 transition hover:border-primary/50 hover:shadow-sm">
    <!-- Stretched link so the whole card opens the project while the action buttons stay clickable. -->
    <NuxtLink
      :to="`/projects/${project.id}`"
      class="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
      :aria-label="`Open ${project.name}`"
    />

    <div class="flex items-start gap-3">
      <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <UIcon
          name="i-lucide-box"
          class="size-4.5"
        />
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="truncate font-semibold text-highlighted group-hover:text-primary">
          {{ project.name }}
        </h2>
        <p class="truncate font-mono text-[11px] text-dimmed">
          {{ project.platform || 'unknown platform' }} · {{ formatCount(project.totalEvents) }} events all time
        </p>
      </div>
      <div class="relative flex shrink-0 items-center gap-1">
        <UBadge
          :color="health.color"
          variant="subtle"
          size="sm"
        >
          {{ health.label }}
        </UBadge>
        <template v-if="project.canManage">
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="`Rename ${project.name}`"
            @click="openRename"
          />
          <ProjectDeleteButton
            :project-id="project.id"
            :project-name="project.name"
            :redirect="false"
            @deleted="emit('changed')"
          />
        </template>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-3">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="min-w-20 flex-1"
      >
        <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">
          {{ stat.label }}
        </p>
        <p
          class="text-lg font-semibold tabular-nums leading-tight"
          :class="stat.tone"
        >
          {{ stat.value }}
        </p>
      </div>
    </div>

    <!-- Above the stretched link so the buckets keep their hover tooltip. -->
    <AppVolumeChart
      :values="project.series"
      :labels="seriesLabels"
      :height="36"
      :duration="0"
      :tone="project.unresolvedCount ? 'error' : 'neutral'"
      class="relative mt-3"
    />

    <div class="mt-3 flex items-center justify-between gap-2 border-t border-default pt-3 font-mono text-[11px] text-dimmed">
      <span>{{ project.lastSeen ? `last event ${formatRelative(project.lastSeen)}` : 'no events yet' }}</span>
      <span
        v-if="project.performance"
        :title="`${formatCount(project.performance.requests7d)} requests · ${project.performance.failureRate.toFixed(1)}% failing`"
      >p95 {{ formatDuration(project.performance.p95Ms) }}</span>
      <span
        v-else-if="project.new7d"
        class="text-warning"
      >{{ formatCount(project.new7d) }} new in 7d</span>
    </div>

    <UModal
      v-model:open="renameOpen"
      title="Rename project"
      description="The DSN and the SDK configuration stay the same."
    >
      <template #body>
        <form
          :id="`rename-${project.id}`"
          class="space-y-3"
          @submit.prevent="rename"
        >
          <UFormField label="Project name">
            <UInput
              v-model="name"
              autofocus
              autocomplete="off"
              class="w-full"
            />
          </UFormField>
          <p
            v-if="renameError"
            class="text-sm text-error"
          >
            {{ renameError }}
          </p>
        </form>
      </template>
      <template #footer="{ close }">
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Cancel"
            @click="close"
          />
          <UButton
            type="submit"
            :form="`rename-${project.id}`"
            label="Save name"
            :disabled="!name.trim()"
            :loading="renaming"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
