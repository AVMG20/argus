<script setup lang="ts">
import { authClient } from '../lib/auth-client'
import type { Organization, ProjectSummary } from '../lib/types'

const session = authClient.useSession()
const organizations = ref<Organization[]>([])
const projects = ref<ProjectSummary[]>([])
const loading = ref(true)

function relativeTime(value: string | null) {
  if (!value) return 'No events yet'
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

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
        class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <USkeleton
          v-for="index in 3"
          :key="index"
          class="h-40"
        />
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
        class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <NuxtLink
          v-for="item in projects"
          :key="item.id"
          :to="`/projects/${item.id}`"
          class="group rounded-lg border border-default bg-elevated p-5 transition hover:border-primary/50 hover:shadow-sm"
        >
          <div class="flex items-start justify-between">
            <span class="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><UIcon
              name="i-lucide-box"
              class="size-5"
            /></span>
            <UBadge
              v-if="item.unresolvedCount"
              color="error"
              variant="subtle"
              size="sm"
            >{{ item.unresolvedCount }} unresolved</UBadge>
            <UBadge
              v-else
              color="success"
              variant="subtle"
              size="sm"
            >Healthy</UBadge>
          </div>
          <h2 class="mt-5 font-semibold group-hover:text-primary">{{ item.name }}</h2>
          <p class="mt-1 text-sm text-muted">{{ item.issueCount }} total {{ item.issueCount === 1 ? 'issue' : 'issues' }}</p>
          <div class="mt-5 flex items-center justify-between border-t border-default pt-4 text-xs text-muted"><span>Last event</span><span>{{ relativeTime(item.lastSeen) }}</span></div>
        </NuxtLink>
      </div>
    </template>
  </UDashboardPanel>
</template>
