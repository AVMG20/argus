<script setup lang="ts">
type IssueItem = {
  id: string
  title: string
  culprit?: string | null
  level: string
  status: string
  eventCount: number
  firstSeen: string
  lastSeen: string
  environments: string[]
  userCount: number
  events24h: number
  lastRelease?: string | null
  lastTransaction?: string | null
  unhandled: boolean
  series: number[]
}
type ProjectResponse = {
  project: { id: string, name: string, slug: string, platform: string }
  issues: IssueItem[]
  series: number[]
  facets: { releases: string[], environments: string[] }
  stats: { unresolved: number, resolved: number, newToday: number, events24h: number, totalEvents: number, affectedUsers: number }
  permissions: { canDelete: boolean }
}
type RequestError = { data?: { message?: string }, statusMessage?: string }
type SortKey = 'lastSeen' | 'firstSeen' | 'events' | 'users' | 'trend'

const route = useRoute()
const toast = useToast()
const { data, status, error, refresh } = await useFetch<ProjectResponse>(() => `/api/projects/${route.params.id}`)

const query = ref(String(route.query.q || ''))
const statusFilter = ref<'unresolved' | 'resolved' | 'all'>('unresolved')
const levelFilter = ref('all')
const environmentFilter = ref('all')
const releaseFilter = ref('all')
const sortKey = ref<SortKey>('lastSeen')
const selectedIds = ref<string[]>([])
const cursor = ref(0)
const bulkUpdating = ref(false)
const bulkError = ref('')
const searchInput = ref<{ inputRef?: HTMLInputElement }>()

const statusItems = [
  { label: 'Unresolved', value: 'unresolved' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'All', value: 'all' }
]
const levelItems = [
  { label: 'All levels', value: 'all' },
  { label: 'Fatal', value: 'fatal' },
  { label: 'Error', value: 'error' },
  { label: 'Warning', value: 'warning' },
  { label: 'Info', value: 'info' }
]
const sortItems = [
  { label: 'Last seen', value: 'lastSeen' },
  { label: 'First seen', value: 'firstSeen' },
  { label: 'Events', value: 'events' },
  { label: 'Users', value: 'users' },
  { label: 'Trend (24h)', value: 'trend' }
]

const environmentItems = computed(() => [
  { label: 'All environments', value: 'all' },
  ...(data.value?.facets.environments || []).map(value => ({ label: value, value }))
])
const releaseItems = computed(() => [
  { label: 'All releases', value: 'all' },
  ...(data.value?.facets.releases || []).map(value => ({ label: value, value }))
])

const allIssues = computed<IssueItem[]>(() => data.value?.issues || [])

const filteredIssues = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const matched = allIssues.value.filter((issue) => {
    if (statusFilter.value !== 'all' && issue.status !== statusFilter.value) return false
    if (levelFilter.value !== 'all' && issue.level !== levelFilter.value) return false
    if (environmentFilter.value !== 'all' && !issue.environments.includes(environmentFilter.value)) return false
    if (releaseFilter.value !== 'all' && issue.lastRelease !== releaseFilter.value) return false
    if (!needle) return true
    return [issue.title, issue.culprit, issue.lastRelease, issue.lastTransaction, ...issue.environments]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(needle))
  })

  return matched.sort((a, b) => {
    if (sortKey.value === 'events') return b.eventCount - a.eventCount
    if (sortKey.value === 'users') return b.userCount - a.userCount
    if (sortKey.value === 'trend') return b.events24h - a.events24h
    if (sortKey.value === 'firstSeen') return new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime()
    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  })
})

const hasFilters = computed(() => Boolean(query.value)
  || statusFilter.value !== 'unresolved'
  || levelFilter.value !== 'all'
  || environmentFilter.value !== 'all'
  || releaseFilter.value !== 'all')

const visibleIds = computed(() => filteredIssues.value.map(item => item.id))
const selectedCount = computed(() => selectedIds.value.length)
const allVisibleSelected = computed(() => visibleIds.value.length > 0 && visibleIds.value.every(id => selectedIds.value.includes(id)))
const someVisibleSelected = computed(() => !allVisibleSelected.value && visibleIds.value.some(id => selectedIds.value.includes(id)))

const metrics = computed(() => [
  { label: 'Unresolved', value: formatCount(data.value?.stats.unresolved), hint: `${data.value?.stats.resolved || 0} resolved`, tone: 'text-error' },
  { label: 'New today', value: formatCount(data.value?.stats.newToday), hint: 'first seen in 24h', tone: 'text-warning' },
  { label: 'Events 24h', value: formatCount(data.value?.stats.events24h), hint: `${formatCount(data.value?.stats.totalEvents)} all time`, tone: 'text-highlighted' },
  { label: 'Users', value: formatCount(data.value?.stats.affectedUsers), hint: 'affected', tone: 'text-highlighted' }
])

const seriesLabels = Array.from({ length: 24 }, (_, index) => {
  const ago = 23 - index
  return ago ? `${ago}h ago` : 'this hour'
})

watch(() => allIssues.value.map(item => item.id), (ids) => {
  const available = new Set(ids)
  selectedIds.value = selectedIds.value.filter(id => available.has(id))
})

watch(filteredIssues, () => {
  cursor.value = Math.min(cursor.value, Math.max(0, filteredIssues.value.length - 1))
})

function issueType(issue: IssueItem) {
  const separator = issue.title.indexOf(': ')
  return separator > 0 ? issue.title.slice(0, separator) : issue.level
}

function issueMessage(issue: IssueItem) {
  const separator = issue.title.indexOf(': ')
  return separator > 0 ? issue.title.slice(separator + 2) : issue.title
}

function accentClass(issue: IssueItem) {
  if (issue.status === 'resolved') return 'border-l-success/70'
  return { error: 'border-l-error/70', warning: 'border-l-warning/70', info: 'border-l-info/70' }[levelTone(issue.level)] || 'border-l-error/70'
}

function clearFilters() {
  query.value = ''
  statusFilter.value = 'unresolved'
  levelFilter.value = 'all'
  environmentFilter.value = 'all'
  releaseFilter.value = 'all'
}

function toggleSelection(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter(current => current !== id)
    : [...selectedIds.value, id]
}

function toggleVisibleSelection(selected: boolean) {
  const visible = new Set(visibleIds.value)
  selectedIds.value = selected
    ? [...new Set([...selectedIds.value, ...visibleIds.value])]
    : selectedIds.value.filter(id => !visible.has(id))
}

function clearSelection() {
  selectedIds.value = []
  bulkError.value = ''
}

async function updateSelectedStatus(nextStatus: 'resolved' | 'unresolved') {
  if (!selectedIds.value.length || bulkUpdating.value) return
  bulkUpdating.value = true
  bulkError.value = ''
  const count = selectedIds.value.length
  try {
    await $fetch('/api/issues/bulk', { method: 'PATCH', body: { ids: selectedIds.value, status: nextStatus } })
    clearSelection()
    await refresh()
    toast.add({
      title: `${count} ${count === 1 ? 'issue' : 'issues'} ${nextStatus === 'resolved' ? 'resolved' : 'reopened'}`,
      icon: nextStatus === 'resolved' ? 'i-lucide-circle-check-big' : 'i-lucide-rotate-ccw',
      color: nextStatus === 'resolved' ? 'success' : 'primary'
    })
  } catch (reason: unknown) {
    const requestError = reason as RequestError
    bulkError.value = requestError.data?.message || requestError.statusMessage || 'Could not update the selected issues.'
  } finally {
    bulkUpdating.value = false
  }
}

function moveCursor(offset: number) {
  if (!filteredIssues.value.length) return
  cursor.value = Math.max(0, Math.min(filteredIssues.value.length - 1, cursor.value + offset))
  document.getElementById(`issue-row-${cursor.value}`)?.scrollIntoView({ block: 'nearest' })
}

defineShortcuts({
  '/': () => searchInput.value?.inputRef?.focus(),
  'j': () => moveCursor(1),
  'k': () => moveCursor(-1),
  'x': () => {
    const issue = filteredIssues.value[cursor.value]
    if (issue) toggleSelection(issue.id)
  },
  'e': () => updateSelectedStatus('resolved'),
  'enter': () => {
    const issue = filteredIssues.value[cursor.value]
    if (issue) navigateTo(`/issues/${issue.id}`)
  }
})
</script>

<template>
  <div class="contents">
    <UDashboardPanel id="project-issues">
      <template #header>
        <UDashboardNavbar :ui="{ root: 'gap-2' }">
          <template #leading>
            <AppNavbarLeading
              back-to="/dashboard"
              back-label="Back to projects"
            />
          </template>
          <template #default>
            <div class="flex min-w-0 items-center gap-2">
              <h1 class="truncate text-sm font-semibold text-highlighted">
                {{ data?.project.name || 'Issues' }}
              </h1>
              <span
                v-if="data"
                class="shrink-0 font-mono text-[11px] text-dimmed"
              >{{ data.project.platform }}</span>
            </div>
          </template>
          <template #right>
            <UButton
              :to="`/projects/${route.params.id}/performance`"
              label="Performance"
              icon="i-lucide-gauge"
              color="neutral"
              variant="outline"
              size="sm"
            />
            <UButton
              :to="`/projects/${route.params.id}/setup`"
              icon="i-lucide-plug"
              label="SDK setup"
              color="neutral"
              variant="outline"
              size="sm"
            />
            <ProjectDeleteButton
              v-if="data?.permissions.canDelete"
              :project-id="String(route.params.id)"
              :project-name="data.project.name"
            />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="mx-auto w-full max-w-[110rem] space-y-3 pb-10">
          <section class="flex flex-wrap items-stretch overflow-hidden rounded-lg border border-default bg-elevated/20">
            <div
              v-for="metric in metrics"
              :key="metric.label"
              class="min-w-32 flex-1 border-r border-default px-3 py-2"
            >
              <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">
                {{ metric.label }}
              </p>
              <p
                class="mt-0.5 text-lg font-semibold tabular-nums leading-tight"
                :class="metric.tone"
              >
                {{ metric.value }}
              </p>
              <p class="truncate text-[10px] text-dimmed">
                {{ metric.hint }}
              </p>
            </div>
            <div class="min-w-56 flex-[2] px-3 py-2">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">
                Events · last 24 hours
              </p>
              <AppVolumeChart
                :values="data?.series || []"
                :labels="seriesLabels"
                :height="40"
                class="mt-1"
              />
            </div>
          </section>

          <section class="sticky top-0 z-10 space-y-2 rounded-lg border border-default bg-default/95 p-2 backdrop-blur">
            <div class="flex flex-wrap items-center gap-2">
              <UInput
                ref="searchInput"
                v-model="query"
                icon="i-lucide-search"
                size="sm"
                placeholder="Search title, location, release, tag…"
                class="min-w-0 flex-1 sm:max-w-sm"
              >
                <template #trailing>
                  <UKbd value="/" />
                </template>
              </UInput>
              <UTabs
                v-model="statusFilter"
                :items="statusItems"
                :content="false"
                size="xs"
                class="shrink-0"
              />
              <USelect
                v-model="levelFilter"
                :items="levelItems"
                size="sm"
                class="w-32"
              />
              <USelect
                v-if="environmentItems.length > 2"
                v-model="environmentFilter"
                :items="environmentItems"
                size="sm"
                class="w-40"
              />
              <USelect
                v-if="releaseItems.length > 2"
                v-model="releaseFilter"
                :items="releaseItems"
                size="sm"
                class="w-44"
              />
              <USelect
                v-model="sortKey"
                :items="sortItems"
                icon="i-lucide-arrow-down-wide-narrow"
                size="sm"
                class="w-40"
              />
              <UButton
                v-if="hasFilters"
                label="Clear"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="clearFilters"
              />
              <span class="ml-auto shrink-0 font-mono text-[11px] text-dimmed">
                {{ filteredIssues.length }} / {{ allIssues.length }}
              </span>
            </div>

            <div
              v-if="selectedCount"
              class="flex flex-wrap items-center gap-2 rounded-md bg-primary/10 px-2 py-1.5"
            >
              <span class="text-xs font-medium text-primary">{{ selectedCount }} selected</span>
              <UButton
                label="Resolve"
                icon="i-lucide-circle-check-big"
                color="success"
                variant="soft"
                size="xs"
                :loading="bulkUpdating"
                @click="updateSelectedStatus('resolved')"
              />
              <UButton
                label="Reopen"
                icon="i-lucide-rotate-ccw"
                color="neutral"
                variant="soft"
                size="xs"
                :disabled="bulkUpdating"
                @click="updateSelectedStatus('unresolved')"
              />
              <UButton
                v-if="!allVisibleSelected"
                :label="`Select all ${filteredIssues.length} shown`"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="toggleVisibleSelection(true)"
              />
              <UButton
                label="Clear"
                color="neutral"
                variant="ghost"
                size="xs"
                class="ml-auto"
                @click="clearSelection"
              />
            </div>

            <UAlert
              v-if="bulkError"
              color="error"
              variant="subtle"
              icon="i-lucide-circle-alert"
              :description="bulkError"
            />
          </section>

          <div
            v-if="status === 'pending'"
            class="space-y-2"
          >
            <USkeleton
              v-for="index in 6"
              :key="index"
              class="h-16 rounded-lg"
            />
          </div>

          <UAlert
            v-else-if="error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="Could not load issues"
            :description="error.statusMessage || error.message"
          />

          <section
            v-else
            aria-label="Issues"
            class="overflow-hidden rounded-lg border border-default"
          >
            <div class="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-3 border-b border-default bg-elevated/40 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-dimmed lg:grid-cols-[1.5rem_minmax(0,1fr)_6rem_4.5rem_4rem_4.5rem]">
              <UCheckbox
                :model-value="allVisibleSelected"
                :indeterminate="someVisibleSelected"
                :aria-label="allVisibleSelected ? 'Deselect all shown issues' : 'Select all shown issues'"
                @update:model-value="toggleVisibleSelection(Boolean($event))"
              />
              <span>Issue</span>
              <span class="hidden lg:block">24h</span>
              <span class="hidden text-right lg:block">Events</span>
              <span class="hidden text-right lg:block">Users</span>
              <span class="hidden text-right lg:block">Last</span>
            </div>

            <UEmpty
              v-if="!filteredIssues.length"
              :icon="hasFilters ? 'i-lucide-search-x' : 'i-lucide-circle-check-big'"
              :title="hasFilters ? 'No issues match these filters' : 'All clear'"
              :description="hasFilters ? 'Try another search or clear the active filters.' : 'New errors appear here as soon as the SDK reports them.'"
              class="py-16"
            >
              <UButton
                v-if="hasFilters"
                label="Clear filters"
                color="neutral"
                variant="outline"
                size="sm"
                @click="clearFilters"
              />
            </UEmpty>

            <div
              v-else
              class="divide-y divide-default"
            >
              <div
                v-for="(issue, index) in filteredIssues"
                :id="`issue-row-${index}`"
                :key="issue.id"
                class="group grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-3 border-l-2 py-2 pl-2 pr-3 transition-colors lg:grid-cols-[1.5rem_minmax(0,1fr)_6rem_4.5rem_4rem_4.5rem]"
                :class="[
                  accentClass(issue),
                  selectedIds.includes(issue.id) ? 'bg-primary/5' : 'hover:bg-elevated/40',
                  cursor === index ? 'bg-elevated/60' : ''
                ]"
                @mouseenter="cursor = index"
              >
                <UCheckbox
                  :model-value="selectedIds.includes(issue.id)"
                  :aria-label="`Select ${issue.title}`"
                  @update:model-value="toggleSelection(issue.id)"
                />

                <NuxtLink
                  :to="`/issues/${issue.id}`"
                  class="min-w-0 rounded focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <div class="flex min-w-0 items-center gap-1.5">
                    <code
                      class="shrink-0 font-mono text-xs font-semibold"
                      :class="issue.status === 'resolved' ? 'text-muted' : 'text-error'"
                    >{{ issueType(issue) }}</code>
                    <UBadge
                      v-if="issue.unhandled"
                      color="error"
                      variant="solid"
                      size="sm"
                    >unhandled</UBadge>
                    <UBadge
                      v-if="issue.status === 'resolved'"
                      color="success"
                      variant="subtle"
                      size="sm"
                    >resolved</UBadge>
                    <span
                      v-for="environment in issue.environments.slice(0, 2)"
                      :key="environment"
                      class="shrink-0 rounded bg-accented/50 px-1 font-mono text-[10px] text-dimmed"
                    >{{ environment }}</span>
                  </div>

                  <p class="mt-0.5 truncate text-sm font-medium text-highlighted group-hover:text-primary">
                    {{ issueMessage(issue) }}
                  </p>

                  <p class="mt-0.5 truncate font-mono text-[11px] text-dimmed">
                    {{ issue.culprit || 'location not captured' }}<template v-if="issue.lastRelease"> · {{ issue.lastRelease }}</template>
                  </p>

                  <div class="mt-1 flex items-center gap-3 font-mono text-[11px] text-dimmed lg:hidden">
                    <span>{{ formatCount(issue.eventCount) }} events</span>
                    <span>{{ formatCount(issue.userCount) }} users</span>
                    <span>{{ formatAge(issue.lastSeen) }} ago</span>
                  </div>
                </NuxtLink>

                <AppVolumeChart
                  :values="issue.series"
                  :labels="seriesLabels"
                  :height="28"
                  :duration="0"
                  :tone="issue.status === 'resolved' ? 'neutral' : 'error'"
                  class="hidden lg:block"
                />
                <span
                  class="hidden text-right font-mono text-xs tabular-nums text-highlighted lg:block"
                  :title="`${issue.events24h} in the last 24 hours`"
                >{{ formatCount(issue.eventCount) }}</span>
                <span class="hidden text-right font-mono text-xs tabular-nums text-muted lg:block">{{ formatCount(issue.userCount) }}</span>
                <span
                  class="hidden text-right font-mono text-xs tabular-nums text-muted lg:block"
                  :title="`First seen ${formatRelative(issue.firstSeen)} · last seen ${formatAbsolute(issue.lastSeen)}`"
                >{{ formatAge(issue.lastSeen) }}</span>
              </div>
            </div>
          </section>

          <p class="px-1 text-[10px] text-dimmed">
            <UKbd
              value="/"
              size="sm"
            /> search · <UKbd
              value="j"
              size="sm"
            /> / <UKbd
              value="k"
              size="sm"
            /> move · <UKbd
              value="x"
              size="sm"
            /> select · <UKbd
              value="e"
              size="sm"
            /> resolve selection · <UKbd
              value="enter"
              size="sm"
            /> open
          </p>
        </div>
      </template>
    </UDashboardPanel>
  </div>
</template>
