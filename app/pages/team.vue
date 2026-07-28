<script setup lang="ts">
import { authClient } from '../lib/auth-client'

const session = authClient.useSession()
const toast = useToast()
const requestUrl = useRequestURL()

const organizations = ref<any[]>([])
const members = ref<any[]>([])
const invitations = ref<any[]>([])
const projects = ref<any[]>([])
const teamName = ref('')
const inviteEmail = ref('')
const inviteRole = ref('member')
const memberQuery = ref('')
const loading = ref(true)
const renaming = ref(false)
const inviting = ref(false)
const error = ref('')

const roleItems = [
  { label: 'Member', value: 'member', description: 'Can view and triage issues' },
  { label: 'Admin', value: 'admin', description: 'Can also manage members and projects' }
]

const activeOrganizationId = computed(() => session.value.data?.session?.activeOrganizationId || organizations.value[0]?.id)
const activeOrganization = computed(() => organizations.value.find(org => org.id === activeOrganizationId.value) || organizations.value[0])
const currentMembership = computed(() => members.value.find(item => item.userId === session.value.data?.user?.id || item.user?.id === session.value.data?.user?.id))
const currentRole = computed(() => currentMembership.value?.role || 'member')
const canManage = computed(() => ['owner', 'admin'].some(role => currentRole.value.split(',').includes(role)))
const isOwner = computed(() => currentRole.value.split(',').includes('owner'))

const filteredMembers = computed(() => {
  const needle = memberQuery.value.trim().toLowerCase()
  if (!needle) return members.value
  return members.value.filter(item => [item.user?.name, item.user?.email, item.role]
    .filter(Boolean)
    .some((value: string) => value.toLowerCase().includes(needle)))
})

const stats = computed(() => [
  { label: 'Members', value: members.value.length, icon: 'i-lucide-users-round' },
  { label: 'Pending invites', value: invitations.value.length, icon: 'i-lucide-mail' },
  { label: 'Projects', value: projects.value.length, icon: 'i-lucide-box' },
  { label: 'Your role', value: currentRole.value, icon: 'i-lucide-shield-check', text: true }
])

function memberInitials(value?: string) {
  return (value || 'A').split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase()
}

function roleColor(role: string) {
  if (role.includes('owner')) return 'primary'
  if (role.includes('admin')) return 'info'
  return 'neutral'
}

function fail(message: string, fallback: string) {
  error.value = message || fallback
  toast.add({ title: error.value, icon: 'i-lucide-circle-alert', color: 'error' })
}

function succeed(message: string) {
  error.value = ''
  toast.add({ title: message, icon: 'i-lucide-check', color: 'success' })
}

async function load() {
  if (!session.value.data?.user) return
  organizations.value = (await authClient.organization.list()).data || []
  if (!activeOrganizationId.value) return navigateTo('/onboarding')
  teamName.value = activeOrganization.value?.name || ''
  const [memberResult, invitationResult, projectResult] = await Promise.all([
    authClient.organization.listMembers({ query: { organizationId: activeOrganizationId.value } }),
    authClient.organization.listInvitations({ query: { organizationId: activeOrganizationId.value } }),
    $fetch<any[]>('/api/projects', { query: { organizationId: activeOrganizationId.value } }).catch(() => [])
  ])
  members.value = memberResult.data?.members || []
  invitations.value = (invitationResult.data || []).filter(invitation => invitation.status === 'pending')
  projects.value = projectResult
  loading.value = false
}

async function renameTeam() {
  const name = teamName.value.trim()
  if (!name || name === activeOrganization.value?.name) return
  renaming.value = true
  const result = await authClient.organization.update({
    organizationId: activeOrganizationId.value,
    data: { name }
  })
  renaming.value = false
  if (result.error) return fail(result.error.message || '', 'Could not rename the team.')
  succeed('Team renamed.')
  await load()
}

async function inviteMember() {
  const email = inviteEmail.value.trim()
  if (!email) return
  inviting.value = true
  const result = await authClient.organization.inviteMember({
    organizationId: activeOrganizationId.value,
    email,
    role: inviteRole.value as 'member' | 'admin'
  })
  inviting.value = false
  if (result.error) return fail(result.error.message || '', 'Could not create the invitation.')
  inviteEmail.value = ''
  succeed(`Invitation created for ${email}.`)
  await load()
}

async function changeRole(item: any, role: string) {
  const result = await authClient.organization.updateMemberRole({
    organizationId: activeOrganizationId.value,
    memberId: item.id,
    role: role as 'member' | 'admin'
  })
  if (result.error) return fail(result.error.message || '', 'Could not change the role.')
  succeed(`${item.user?.name || 'Member'} is now ${role}.`)
  await load()
}

async function removeMember(item: any) {
  const result = await authClient.organization.removeMember({
    organizationId: activeOrganizationId.value,
    memberIdOrEmail: item.user?.email || item.userId
  })
  if (result.error) return fail(result.error.message || '', 'Could not remove the member.')
  succeed(`${item.user?.name || 'Member'} removed from the team.`)
  await load()
}

function inviteLink(invitation: any) {
  return `${requestUrl.origin}/sign-in?email=${encodeURIComponent(invitation.email)}`
}

async function cancelInvitation(invitation: any) {
  const result = await authClient.organization.cancelInvitation({ invitationId: invitation.id })
  if (result.error) return fail(result.error.message || '', 'Could not cancel the invitation.')
  succeed(`Invitation for ${invitation.email} cancelled.`)
  await load()
}

function memberActions(item: any) {
  const actions = []
  if (!item.role?.includes('owner')) {
    actions.push(roleItems
      .filter(role => !item.role?.includes(role.value))
      .map(role => ({
        label: `Make ${role.label.toLowerCase()}`,
        icon: role.value === 'admin' ? 'i-lucide-shield' : 'i-lucide-user-round',
        onSelect: () => changeRole(item, role.value)
      })))
    actions.push([{ label: 'Remove from team', icon: 'i-lucide-user-minus', color: 'error' as const, onSelect: () => removeMember(item) }])
  }
  return actions
}

watch(() => session.value.data?.user?.id, load, { immediate: true })
</script>

<template>
  <UDashboardPanel id="team">
    <template #header>
      <UDashboardNavbar title="Team">
        <template #leading>
          <AppNavbarLeading />
        </template>
        <template #right>
          <UBadge :color="roleColor(currentRole)" variant="subtle" class="capitalize">{{ currentRole }}</UBadge>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-5xl space-y-6 pb-12">
        <!-- Team header -->
        <section class="relative overflow-hidden rounded-xl border border-default bg-elevated/40 p-6">
          <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_120%_at_0%_0%,var(--ui-primary)_0%,transparent_70%)] opacity-[0.08]" />
          <div class="relative flex flex-wrap items-center gap-4">
            <span class="grid size-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
              {{ (activeOrganization?.name || 'T').slice(0, 1).toUpperCase() }}
            </span>
            <div class="min-w-0 flex-1">
              <h1 class="truncate text-2xl font-semibold tracking-tight">{{ activeOrganization?.name || 'Team' }}</h1>
              <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-dimmed">
                <span>{{ activeOrganization?.slug }}</span>
                <span v-if="activeOrganization?.createdAt">· created {{ formatAbsolute(activeOrganization.createdAt) }}</span>
              </p>
            </div>
            <UButton to="/projects/new" icon="i-lucide-plus" label="New project" color="neutral" variant="outline" />
          </div>

          <div class="relative mt-6 grid gap-px overflow-hidden rounded-lg border border-default bg-default sm:grid-cols-4">
            <div v-for="stat in stats" :key="stat.label" class="bg-default px-4 py-3 outline outline-default/60">
              <p class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-dimmed">
                <UIcon :name="stat.icon" class="size-3.5" /> {{ stat.label }}
              </p>
              <p class="mt-1 text-lg font-semibold leading-tight" :class="stat.text ? 'capitalize' : 'tabular-nums'">{{ stat.value }}</p>
            </div>
          </div>
        </section>

        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :description="error" />

        <!-- Members -->
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="font-semibold">Members</h2>
                <p class="mt-1 text-sm text-muted">{{ members.length }} {{ members.length === 1 ? 'person has' : 'people have' }} access to every project in this team.</p>
              </div>
              <UInput
                v-if="members.length > 5"
                v-model="memberQuery"
                icon="i-lucide-search"
                size="sm"
                placeholder="Search members…"
                class="w-56"
              />
            </div>
          </template>

          <div v-if="loading" class="space-y-2">
            <USkeleton v-for="index in 3" :key="index" class="h-12" />
          </div>

          <UEmpty
            v-else-if="!filteredMembers.length"
            icon="i-lucide-search-x"
            title="No members match that search"
            description="Try a different name or email."
          />

          <div v-else class="divide-y divide-default">
            <div v-for="item in filteredMembers" :key="item.id" class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <UAvatar :alt="item.user?.name" :text="memberInitials(item.user?.name)" size="md" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">
                  {{ item.user?.name }}
                  <span v-if="item.user?.id === session.data?.user?.id" class="font-normal text-muted">(you)</span>
                </p>
                <p class="truncate text-xs text-muted">{{ item.user?.email }}</p>
              </div>
              <UBadge :color="roleColor(item.role)" variant="subtle" class="capitalize">{{ item.role }}</UBadge>
              <UDropdownMenu
                v-if="canManage && item.user?.id !== session.data?.user?.id && !item.role?.includes('owner')"
                :items="memberActions(item)"
              >
                <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" aria-label="Member actions" />
              </UDropdownMenu>
              <span v-else class="w-8" />
            </div>
          </div>
        </UCard>

        <!-- Invitations -->
        <UCard>
          <template #header>
            <div>
              <h2 class="font-semibold">Invitations</h2>
              <p class="mt-1 text-sm text-muted">
                This instance does not send email. Share the link below with each person — it's tied to their email, so the invitation is waiting once they sign in.
              </p>
            </div>
          </template>

          <form v-if="canManage" class="flex flex-wrap items-end gap-3" @submit.prevent="inviteMember">
            <UFormField label="Email address" class="min-w-56 flex-1">
              <UInput v-model="inviteEmail" type="email" icon="i-lucide-mail" placeholder="developer@company.com" class="w-full" />
            </UFormField>
            <UFormField label="Role">
              <USelect v-model="inviteRole" :items="roleItems" value-key="value" class="w-36" />
            </UFormField>
            <UButton type="submit" :loading="inviting" icon="i-lucide-send" label="Invite" />
          </form>

          <div v-if="invitations.length" class="mt-5 divide-y divide-default border-t border-default pt-2">
            <div v-for="invitation in invitations" :key="invitation.id" class="flex flex-col gap-3 py-3">
              <div class="flex items-center gap-3">
                <span class="grid size-9 shrink-0 place-items-center rounded-full bg-warning/10">
                  <UIcon name="i-lucide-mail" class="size-4 text-warning" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ invitation.email }}</p>
                  <p class="text-xs text-muted">
                    Invited as {{ invitation.role }}
                    <template v-if="invitation.expiresAt"> · expires {{ formatAbsolute(invitation.expiresAt) }}</template>
                  </p>
                </div>
                <UBadge color="warning" variant="subtle">Pending</UBadge>
                <UButton
                  v-if="canManage"
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Cancel invitation"
                  @click="cancelInvitation(invitation)"
                />
              </div>
              <div class="ml-12 flex items-center gap-2 rounded-lg border border-default bg-muted px-3 py-2">
                <UIcon name="i-lucide-link" class="size-4 shrink-0 text-dimmed" />
                <code class="min-w-0 flex-1 truncate font-mono text-xs text-muted">{{ inviteLink(invitation) }}</code>
                <CopyButton :value="inviteLink(invitation)" label="Copy" variant="soft" size="xs" />
              </div>
            </div>
          </div>
          <p v-else class="mt-5 text-sm text-dimmed">No invitations are waiting.</p>
        </UCard>

        <!-- Team details -->
        <UCard v-if="canManage">
          <template #header>
            <div>
              <h2 class="font-semibold">Team details</h2>
              <p class="mt-1 text-sm text-muted">The name appears in the sidebar switcher and across Argus.</p>
            </div>
          </template>
          <form class="flex flex-wrap items-end gap-3" @submit.prevent="renameTeam">
            <UFormField label="Team name" class="min-w-56 flex-1">
              <UInput v-model="teamName" :disabled="!isOwner && !canManage" class="w-full" />
            </UFormField>
            <UButton type="submit" :loading="renaming" :disabled="!teamName.trim() || teamName.trim() === activeOrganization?.name" label="Save" />
          </form>
        </UCard>

        <p v-else class="text-center text-sm text-dimmed">
          Only owners and admins can change team settings or invite people.
        </p>
      </div>
    </template>
  </UDashboardPanel>
</template>
