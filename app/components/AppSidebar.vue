<script setup lang="ts">
import { authClient } from '../lib/auth-client'
import type { Organization, ProjectSummary } from '../lib/types'

const route = useRoute()
const session = authClient.useSession()
const { appearance, sidebarClass, isDark, set, reset, toggleColorMode } = useAppearance()
const organizations = ref<Organization[]>([])
const projects = ref<ProjectSummary[]>([])

const activeOrganizationId = computed(() => session.value.data?.session?.activeOrganizationId || organizations.value[0]?.id)
const activeOrganization = computed(() => organizations.value.find(org => org.id === activeOrganizationId.value) || organizations.value[0])
const profileName = computed(() => session.value.data?.user?.name || 'Account')
const initials = computed(() => profileName.value.split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase())

const mainItems = computed(() => [
  { label: 'Projects', icon: 'i-lucide-layout-dashboard', to: '/', active: route.path === '/' },
  { label: 'Team', icon: 'i-lucide-users-round', to: '/team', active: route.path === '/team' },
  { label: 'Profile', icon: 'i-lucide-user-round', to: '/profile', active: route.path === '/profile' }
])

const projectItems = computed(() => projects.value.map(item => ({
  label: item.name,
  icon: 'i-lucide-box',
  type: 'trigger' as const,
  defaultOpen: true,
  active: route.path.startsWith(`/projects/${item.id}`),
  children: [
    {
      label: 'Issues',
      icon: 'i-lucide-circle-alert',
      to: `/projects/${item.id}`,
      active: route.path === `/projects/${item.id}`,
      badge: item.unresolvedCount || undefined
    },
    {
      label: 'Performance',
      icon: 'i-lucide-gauge',
      to: `/projects/${item.id}/performance`,
      active: route.path.startsWith(`/projects/${item.id}/performance`)
    }
  ]
})))

const profileItems = computed(() => [
  [
    { label: profileName.value, type: 'label' as const },
    { label: 'Profile settings', icon: 'i-lucide-settings', to: '/profile' },
    { label: 'Team management', icon: 'i-lucide-users-round', to: '/team' }
  ],
  [
    {
      label: isDark.value ? 'Switch to light mode' : 'Switch to dark mode',
      icon: isDark.value ? 'i-lucide-sun' : 'i-lucide-moon',
      onSelect: toggleColorMode
    }
  ],
  [
    { label: 'Sign out', icon: 'i-lucide-log-out', color: 'error' as const, onSelect: signOut }
  ]
])

async function loadProjects() {
  if (!activeOrganizationId.value) return projects.value = []
  projects.value = await $fetch<ProjectSummary[]>('/api/projects', { query: { organizationId: activeOrganizationId.value } }).catch(() => [])
}

async function loadOrganizations() {
  if (!session.value.data?.user) return
  organizations.value = (await authClient.organization.list()).data || []
  await loadProjects()
}

async function switchOrganization(id: string) {
  await authClient.organization.setActive({ organizationId: id })
  await authClient.getSession({ fetchOptions: { query: { disableCookieCache: true } } })
  await loadOrganizations()
  await navigateTo('/')
}

async function signOut() {
  await authClient.signOut()
  await navigateTo('/sign-in')
}

watch(() => session.value.data?.user?.id, loadOrganizations, { immediate: true })
watch(() => route.fullPath, loadProjects)
</script>

<template>
  <UDashboardSidebar
    id="argus"
    collapsible
    resizable
    :min-size="13"
    :default-size="17"
    :max-size="22"
    :collapsed-size="4"
    :ui="{ root: sidebarClass, body: 'gap-4' }"
  >
    <template #header="{ collapsed }">
      <div
        class="relative flex w-full items-center gap-2"
        :class="collapsed ? 'justify-center' : ''"
      >
        <NuxtLink
          to="/"
          class="grid size-8 shrink-0 place-items-center rounded-lg bg-neutral-950"
          aria-label="Go to projects"
        >
          <img
            src="/argus-logo.png"
            alt=""
            class="size-6 object-contain"
          >
        </NuxtLink>
        <span
          v-if="!collapsed"
          class="font-bold tracking-tight"
        >Argus</span>
        <UDashboardSidebarCollapse
          v-if="!collapsed"
          class="ml-auto"
        />
      </div>
    </template>

    <template #default="{ collapsed }">
      <UDropdownMenu
        :items="[
          ...organizations.map(org => ({
            label: org.name,
            icon: org.id === activeOrganizationId ? 'i-lucide-check' : 'i-lucide-building-2',
            onSelect: () => switchOrganization(org.id)
          })),
          { type: 'separator' },
          { label: 'Manage team', icon: 'i-lucide-settings-2', to: '/team' }
        ]"
        :content="{ align: 'start' }"
      >
        <UButton
          color="neutral"
          :variant="collapsed ? 'ghost' : 'soft'"
          :aria-label="`Switch team from ${activeOrganization?.name || 'Team'}`"
          :title="collapsed ? activeOrganization?.name || 'Team' : undefined"
          :class="collapsed ? 'mx-auto size-10 justify-center p-0' : 'w-full justify-start'"
        >
          <span
            class="grid shrink-0 place-items-center bg-primary/10 text-xs font-bold text-primary"
            :class="collapsed ? 'size-9 rounded-lg' : 'size-6 rounded-md'"
          >{{ activeOrganization?.name?.slice(0, 1).toUpperCase() || 'T' }}</span>
          <span
            v-if="!collapsed"
            class="min-w-0 flex-1 truncate text-left"
          >{{ activeOrganization?.name || 'Team' }}</span>
          <UIcon
            v-if="!collapsed"
            name="i-lucide-chevrons-up-down"
            class="size-4 text-muted"
          />
        </UButton>
      </UDropdownMenu>

      <UNavigationMenu
        orientation="vertical"
        :items="mainItems"
        :collapsed="collapsed"
        tooltip
        class="w-full"
      />

      <div
        v-if="projectItems.length"
        class="min-h-0 flex-1 overflow-y-auto"
      >
        <div
          v-if="!collapsed"
          class="mb-2 flex items-center justify-between gap-2 px-2"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wider text-dimmed">
            Projects
          </p>
          <UButton
            to="/projects/new"
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="New project"
          />
        </div>
        <UNavigationMenu
          orientation="vertical"
          :items="projectItems"
          :collapsed="collapsed"
          tooltip
          :popover="{ mode: 'click' }"
          class="w-full"
        />
      </div>
    </template>

    <template #footer="{ collapsed }">
      <div
        class="flex w-full items-center gap-1"
        :class="collapsed ? 'flex-col' : ''"
      >
        <UDropdownMenu
          :items="profileItems"
          :content="{ align: 'start', side: 'top' }"
          class="min-w-0 flex-1"
        >
          <UButton
            color="neutral"
            variant="ghost"
            class="w-full justify-start"
          >
            <UAvatar
              :text="initials"
              size="sm"
            />
            <span
              v-if="!collapsed"
              class="min-w-0 flex-1 truncate text-left"
            >{{ profileName }}</span>
            <UIcon
              v-if="!collapsed"
              name="i-lucide-ellipsis"
              class="size-4 text-muted"
            />
          </UButton>
        </UDropdownMenu>

        <UPopover :content="{ align: 'end', side: 'top' }">
          <UButton
            icon="i-lucide-palette"
            color="neutral"
            variant="ghost"
            aria-label="Appearance settings"
          />

          <template #content>
            <div class="w-72 space-y-4 p-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold">
                  Appearance
                </h3>
                <UButton
                  label="Reset"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="reset"
                />
              </div>

              <div>
                <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                  Accent color
                </p>
                <div class="grid grid-cols-9 gap-1.5">
                  <button
                    v-for="color in primaryColors"
                    :key="color.value"
                    type="button"
                    :title="color.label"
                    :aria-label="color.label"
                    :aria-pressed="appearance.primary === color.value"
                    class="grid size-6 place-items-center rounded-full ring-offset-2 ring-offset-default transition hover:scale-110"
                    :class="appearance.primary === color.value ? 'ring-2 ring-inverted/60' : ''"
                    :style="{ backgroundColor: color.hex }"
                    @click="set({ primary: color.value })"
                  >
                    <UIcon
                      v-if="appearance.primary === color.value"
                      name="i-lucide-check"
                      class="size-3.5 text-white drop-shadow"
                    />
                  </button>
                </div>
              </div>

              <div>
                <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                  Gray shade
                </p>
                <div class="flex gap-1.5">
                  <button
                    v-for="color in neutralColors"
                    :key="color.value"
                    type="button"
                    :title="color.label"
                    :aria-label="color.label"
                    :aria-pressed="appearance.neutral === color.value"
                    class="grid size-6 place-items-center rounded-full ring-offset-2 ring-offset-default transition hover:scale-110"
                    :class="appearance.neutral === color.value ? 'ring-2 ring-inverted/60' : ''"
                    :style="{ backgroundColor: color.hex }"
                    @click="set({ neutral: color.value })"
                  >
                    <UIcon
                      v-if="appearance.neutral === color.value"
                      name="i-lucide-check"
                      class="size-3.5 text-white drop-shadow"
                    />
                  </button>
                </div>
              </div>

              <div>
                <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                  Sidebar background
                </p>
                <div class="grid grid-cols-3 gap-1.5">
                  <button
                    v-for="background in sidebarBackgrounds"
                    :key="background.value"
                    type="button"
                    :title="background.description"
                    :aria-pressed="appearance.sidebar === background.value"
                    class="flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] transition"
                    :class="appearance.sidebar === background.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-default text-muted hover:bg-elevated'"
                    @click="set({ sidebar: background.value })"
                  >
                    <UIcon
                      :name="background.icon"
                      class="size-4"
                    />
                    {{ background.label }}
                  </button>
                </div>
              </div>

              <div>
                <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                  Mode
                </p>
                <UButton
                  block
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
                  :label="isDark ? 'Switch to light' : 'Switch to dark'"
                  @click="toggleColorMode"
                />
              </div>
            </div>
          </template>
        </UPopover>
      </div>
    </template>
  </UDashboardSidebar>
</template>
