<script setup lang="ts">
import { authClient } from '../lib/auth-client'
import type { Organization, ProjectSummary } from '../lib/types'

const session = authClient.useSession()
const organizations = ref<Organization[]>([])
const projects = ref<ProjectSummary[]>([])
const loading = ref(true)

const totals = computed(() => ({
  unresolved: projects.value.reduce((sum, item) => sum + item.unresolvedCount, 0),
  events7d: projects.value.reduce((sum, item) => sum + item.events7d, 0),
  requests7d: projects.value.reduce((sum, item) => sum + (item.performance?.requests7d || 0), 0)
}))

async function load() {
  loading.value = true

  try {
    // A client-side redirect from /sign-in can mount this page before the
    // reactive session store has completed its initial request. Fetching here
    // keeps the dashboard from remaining in its loading state in that window.
    const currentSession = session.value.data?.user
      ? session.value.data
      : (await authClient.getSession()).data

    if (!currentSession?.user) {
      await navigateTo('/sign-in')
      return
    }

    organizations.value = (await authClient.organization.list()).data || []
    if (!organizations.value.length) {
      await navigateTo('/onboarding')
      return
    }

    const organizationId = currentSession.session?.activeOrganizationId || organizations.value[0]?.id
    if (organizationId) {
      projects.value = await $fetch<ProjectSummary[]>('/api/projects', { query: { organizationId } })
    }
  } catch {
    projects.value = []
  } finally {
    loading.value = false
  }
}

watch(() => session.value.data?.user?.id, load, { immediate: true })
</script>

<template>
  <UDashboardPanel id="projects">
    <template #header>
      <UDashboardNavbar title="Projects">
        <template #leading>
          <AppNavbarLeading />
        </template>
        <template #right>
          <UButton
            to="/projects/new"
            icon="i-lucide-plus"
            label="New project"
          />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div
        v-if="loading"
        class="space-y-4"
      >
        <section class="flex flex-wrap items-stretch overflow-hidden rounded-lg border border-default bg-elevated/20">
          <div
            v-for="index in 4"
            :key="index"
            class="min-w-32 flex-1 space-y-1.5 border-r border-default px-3 py-2 last:border-r-0"
          >
            <USkeleton class="h-2.5 w-16" />
            <USkeleton class="h-5 w-12" />
            <USkeleton class="h-2.5 w-20" />
          </div>
        </section>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="index in 3"
            :key="index"
            class="flex flex-col rounded-lg border border-default bg-elevated/30 p-4"
          >
            <div class="flex items-start gap-3">
              <USkeleton class="size-9 shrink-0 rounded-lg" />
              <div class="min-w-0 flex-1 space-y-1.5">
                <USkeleton class="h-4 w-32" />
                <USkeleton class="h-3 w-40" />
              </div>
              <USkeleton class="h-5 w-24 shrink-0 rounded-full" />
            </div>

            <div class="mt-4 flex flex-wrap gap-3">
              <div
                v-for="stat in 4"
                :key="stat"
                class="min-w-20 flex-1 space-y-1.5"
              >
                <USkeleton class="h-2.5 w-14" />
                <USkeleton class="h-5 w-10" />
              </div>
            </div>

            <USkeleton class="mt-3 h-9" />

            <div class="mt-3 flex items-center justify-between gap-2 border-t border-default pt-3">
              <USkeleton class="h-3 w-28" />
              <USkeleton class="h-3 w-16" />
            </div>
          </div>
        </div>
      </div>
      <UEmpty
        v-else-if="!projects.length"
        icon="i-lucide-box"
        title="Create your first project"
        description="Projects collect and group errors from one application."
        :actions="[{ label: 'Create project', icon: 'i-lucide-plus', to: '/projects/new' }]"
        class="mt-20"
      />
      <div
        v-else
        class="space-y-4"
      >
        <section class="flex flex-wrap items-stretch overflow-hidden rounded-lg border border-default bg-elevated/20">
          <div
            v-for="total in [
              { label: 'Projects', value: formatCount(projects.length), hint: 'in this team', tone: 'text-highlighted' },
              { label: 'Unresolved', value: formatCount(totals.unresolved), hint: 'across all projects', tone: totals.unresolved ? 'text-error' : 'text-success' },
              { label: 'Events 7d', value: formatCount(totals.events7d), hint: 'errors received', tone: 'text-highlighted' },
              { label: 'Requests 7d', value: formatCount(totals.requests7d), hint: 'transactions traced', tone: 'text-highlighted' }
            ]"
            :key="total.label"
            class="min-w-32 flex-1 border-r border-default px-3 py-2 last:border-r-0"
          >
            <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">
              {{ total.label }}
            </p>
            <p
              class="mt-0.5 text-lg font-semibold tabular-nums leading-tight"
              :class="total.tone"
            >
              {{ total.value }}
            </p>
            <p class="truncate text-[10px] text-dimmed">
              {{ total.hint }}
            </p>
          </div>
        </section>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ProjectCard
            v-for="item in projects"
            :key="item.id"
            :project="item"
            @changed="load"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
