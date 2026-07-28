<script setup lang="ts">
import { authClient } from '../lib/auth-client'

type Invitation = {
  id: string
  status: string
  organizationName?: string
  role?: string
}

const session = authClient.useSession()
const route = useRoute()
const teamName = ref('')
const invitations = ref<Invitation[]>([])
const pending = ref(false)
const accepting = ref('')
const error = ref('')

const invitationId = typeof route.query.invite === 'string' ? route.query.invite : ''

useSeoMeta({ title: 'Join or create a team — Argus' })

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function loadInvitations() {
  if (!session.value.data?.user) return
  const result = await authClient.organization.listUserInvitations()
  if (result.error) {
    error.value = result.error.message || 'Could not load your invitations.'
    return
  }
  invitations.value = (result.data || []).filter(invitation => invitation.status === 'pending')
  // Arriving from an invitation link — accept that invitation straight away.
  if (invitationId && invitations.value.some(invitation => invitation.id === invitationId)) {
    await acceptInvitation(invitationId)
  }
}

async function createTeam() {
  const name = teamName.value.trim()
  if (!name) return
  pending.value = true
  error.value = ''
  const result = await authClient.organization.create({
    name,
    slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`
  })
  pending.value = false
  if (result.error) return error.value = result.error.message || 'Could not create the team.'
  if (result.data?.id) await authClient.organization.setActive({ organizationId: result.data.id })
  await navigateTo('/')
}

async function acceptInvitation(invitationId: string) {
  accepting.value = invitationId
  error.value = ''
  const result = await authClient.organization.acceptInvitation({ invitationId })
  if (result.error) {
    accepting.value = ''
    return error.value = result.error.message || 'Could not accept the invitation.'
  }
  const organizationId = result.data?.invitation?.organizationId
  if (organizationId) await authClient.organization.setActive({ organizationId })
  await navigateTo('/')
}

watch(() => session.value.data?.user?.id, loadInvitations, { immediate: true })
</script>

<template>
  <UDashboardPanel id="onboarding">
    <template #header>
      <UDashboardNavbar title="Set up your workspace">
        <template #leading>
          <AppNavbarLeading />
        </template>
        <template #right>
          <span class="hidden text-sm text-muted sm:block">{{ session.data?.user?.email }}</span>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto flex min-h-full w-full max-w-5xl items-center py-8 lg:py-12">
        <div class="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16">
          <section class="max-w-xl">
            <UBadge
              color="primary"
              variant="subtle"
              icon="i-lucide-sparkles"
            >
              Get started
            </UBadge>
            <h1 class="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Create your team space
            </h1>
            <p class="mt-4 max-w-lg leading-7 text-muted">
              Teams keep members, projects, and error data together. You can invite collaborators as soon as your workspace is ready.
            </p>
            <div class="mt-8 hidden space-y-4 sm:block">
              <div class="flex items-center gap-3 text-sm text-muted">
                <span class="grid size-7 place-items-center rounded-full bg-primary/10 text-primary"><UIcon
                  name="i-lucide-users-round"
                  class="size-3.5"
                /></span>Invite your team when you are ready
              </div>
              <div class="flex items-center gap-3 text-sm text-muted">
                <span class="grid size-7 place-items-center rounded-full bg-primary/10 text-primary"><UIcon
                  name="i-lucide-box"
                  class="size-3.5"
                /></span>Add projects and start tracking errors
              </div>
            </div>
          </section>

          <div
            class="grid gap-5"
            :class="invitations.length ? 'md:grid-cols-2 lg:grid-cols-1' : ''"
          >
            <UCard :ui="{ root: 'h-full shadow-sm' }">
              <template #header>
                <div class="flex items-start gap-3">
                  <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><UIcon
                    name="i-lucide-plus"
                    class="size-4"
                  /></span>
                  <div>
                    <h2 class="font-semibold">
                      Create a new team
                    </h2>
                    <p class="mt-1 text-sm text-muted">
                      You become the owner and can invite others right after.
                    </p>
                  </div>
                </div>
              </template>
              <form
                class="space-y-4"
                @submit.prevent="createTeam"
              >
                <UFormField label="Team name">
                  <UInput
                    v-model="teamName"
                    placeholder="Acme Engineering"
                    autofocus
                    icon="i-lucide-building-2"
                    class="w-full"
                  />
                </UFormField>
                <UButton
                  type="submit"
                  block
                  size="lg"
                  :loading="pending"
                  :disabled="!teamName.trim()"
                  trailing-icon="i-lucide-arrow-right"
                >
                  Create team
                </UButton>
              </form>
            </UCard>

            <UCard
              v-if="invitations.length"
              :ui="{ root: 'h-full shadow-sm' }"
            >
              <template #header>
                <div class="flex items-start gap-3">
                  <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning"><UIcon
                    name="i-lucide-mail-open"
                    class="size-4"
                  /></span>
                  <div>
                    <h2 class="font-semibold">
                      You have been invited
                    </h2>
                    <p class="mt-1 text-sm text-muted">
                      Join an existing team instead of starting a new one.
                    </p>
                  </div>
                </div>
              </template>
              <div class="space-y-3">
                <div
                  v-for="invitation in invitations"
                  :key="invitation.id"
                  class="flex items-center gap-3 rounded-lg border border-default p-3"
                >
                  <span class="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 font-semibold text-primary">
                    {{ (invitation.organizationName || 'T').slice(0, 1).toUpperCase() }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">
                      {{ invitation.organizationName || 'Team invitation' }}
                    </p>
                    <p class="text-xs capitalize text-muted">
                      {{ invitation.role || 'member' }}
                    </p>
                  </div>
                  <UButton
                    size="sm"
                    :loading="accepting === invitation.id"
                    @click="acceptInvitation(invitation.id)"
                  >
                    Join
                  </UButton>
                </div>
              </div>
            </UCard>
          </div>

          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :description="error"
            class="lg:col-start-2"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
