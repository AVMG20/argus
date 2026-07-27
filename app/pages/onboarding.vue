<script setup lang="ts">
import { authClient } from '../lib/auth-client'

const session = authClient.useSession()
const teamName = ref('')
const invitations = ref<any[]>([])
const pending = ref(false)
const accepting = ref('')
const error = ref('')

useSeoMeta({ title: 'Join or create a team — Argus' })

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function loadInvitations() {
  if (!session.value.data?.user) return
  invitations.value = ((await authClient.organization.listUserInvitations()).data || []).filter(invitation => invitation.status === 'pending')
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
  await navigateTo('/dashboard')
}

async function acceptInvitation(invitationId: string) {
  accepting.value = invitationId
  error.value = ''
  const result = await authClient.organization.acceptInvitation({ invitationId })
  if (result.error) {
    accepting.value = ''
    return error.value = result.error.message || 'Could not accept the invitation.'
  }
  const organizations = (await authClient.organization.list()).data || []
  if (organizations[0]?.id) await authClient.organization.setActive({ organizationId: organizations[0].id })
  await navigateTo('/dashboard')
}

async function signOut() {
  await authClient.signOut()
  await navigateTo('/sign-in')
}

watch(() => session.value.data?.user?.id, loadInvitations, { immediate: true })
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-default p-6">
    <div class="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] bg-[radial-gradient(50%_60%_at_50%_0%,var(--ui-primary)_0%,transparent_70%)] opacity-[0.12]" />
    <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--ui-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--ui-border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-30 [mask-image:radial-gradient(60%_40%_at_50%_0%,black,transparent)]" />

    <div class="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col">
      <header class="flex items-center justify-between gap-4">
        <NuxtLink to="/" class="flex items-center gap-2 font-bold tracking-tight">
          <span class="grid size-8 place-items-center rounded-lg bg-primary text-inverted"><UIcon name="i-lucide-scan-eye" class="size-4" /></span>Argus
        </NuxtLink>
        <div class="flex items-center gap-3">
          <span class="hidden text-sm text-muted sm:block">{{ session.data?.user?.email }}</span>
          <UButton label="Sign out" color="neutral" variant="ghost" size="sm" icon="i-lucide-log-out" @click="signOut" />
        </div>
      </header>

      <main class="my-auto py-12">
        <div class="mx-auto max-w-2xl text-center">
          <UBadge color="neutral" variant="subtle">One step before your dashboard</UBadge>
          <h1 class="mt-5 text-4xl font-semibold tracking-tight">Join or create a team</h1>
          <p class="mx-auto mt-4 max-w-lg leading-7 text-muted">
            Every Argus project belongs to a team. Members, projects, and error data stay scoped to it.
          </p>
        </div>

        <div class="mx-auto mt-10 grid max-w-3xl gap-5" :class="invitations.length ? 'md:grid-cols-2' : 'max-w-md'">
          <UCard :ui="{ root: 'h-full' }">
            <template #header>
              <div class="flex items-start gap-3">
                <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><UIcon name="i-lucide-plus" class="size-4" /></span>
                <div>
                  <h2 class="font-semibold">Create a new team</h2>
                  <p class="mt-1 text-sm text-muted">You become the owner and can invite others right after.</p>
                </div>
              </div>
            </template>
            <form class="space-y-4" @submit.prevent="createTeam">
              <UFormField label="Team name">
                <UInput v-model="teamName" placeholder="Acme Engineering" autofocus icon="i-lucide-building-2" class="w-full" />
              </UFormField>
              <UButton type="submit" block size="lg" :loading="pending" :disabled="!teamName.trim()" trailing-icon="i-lucide-arrow-right">
                Create team
              </UButton>
            </form>
          </UCard>

          <UCard v-if="invitations.length" :ui="{ root: 'h-full' }">
            <template #header>
              <div class="flex items-start gap-3">
                <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning"><UIcon name="i-lucide-mail-open" class="size-4" /></span>
                <div>
                  <h2 class="font-semibold">You have been invited</h2>
                  <p class="mt-1 text-sm text-muted">Join an existing team instead of starting a new one.</p>
                </div>
              </div>
            </template>
            <div class="space-y-3">
              <div v-for="invitation in invitations" :key="invitation.id" class="flex items-center gap-3 rounded-lg border border-default p-3">
                <span class="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 font-semibold text-primary">
                  {{ (invitation.organizationName || 'T').slice(0, 1).toUpperCase() }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ invitation.organizationName || 'Team invitation' }}</p>
                  <p class="text-xs capitalize text-muted">{{ invitation.role || 'member' }}</p>
                </div>
                <UButton size="sm" :loading="accepting === invitation.id" @click="acceptInvitation(invitation.id)">Join</UButton>
              </div>
            </div>
          </UCard>
        </div>

        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :description="error" class="mx-auto mt-5 max-w-md" />
      </main>

      <p class="text-center text-xs text-dimmed">Open source error tracking, MIT licensed.</p>
    </div>
  </div>
</template>
