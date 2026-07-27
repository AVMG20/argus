<script setup lang="ts">
import { authClient } from '../lib/auth-client'

const session = authClient.useSession()
const name = ref('')
const accounts = ref<any[]>([])
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingProfile = ref(false)
const savingPassword = ref(false)
const profileFeedback = ref('')
const passwordFeedback = ref('')
const profileError = ref('')
const passwordError = ref('')

const hasPassword = computed(() => accounts.value.some(account => account.providerId === 'credential'))
const initials = computed(() => (session.value.data?.user?.name || 'A').split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase())

async function load() {
  if (!session.value.data?.user) return
  name.value = session.value.data.user.name
  accounts.value = (await authClient.listAccounts()).data || []
}

async function updateProfile() {
  savingProfile.value = true
  profileError.value = ''
  profileFeedback.value = ''
  const result = await authClient.updateUser({ name: name.value.trim() })
  savingProfile.value = false
  if (result.error) return profileError.value = result.error.message || 'Could not update your profile.'
  await authClient.getSession({ fetchOptions: { query: { disableCookieCache: true } } })
  profileFeedback.value = 'Profile updated.'
}

async function changePassword() {
  passwordError.value = ''
  passwordFeedback.value = ''
  if (newPassword.value.length < 8) return passwordError.value = 'Use at least 8 characters.'
  if (newPassword.value !== confirmPassword.value) return passwordError.value = 'The new passwords do not match.'
  savingPassword.value = true
  const result = await authClient.changePassword({
    currentPassword: currentPassword.value,
    newPassword: newPassword.value,
    revokeOtherSessions: true
  })
  savingPassword.value = false
  if (result.error) return passwordError.value = result.error.message || 'Could not change your password.'
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordFeedback.value = 'Password changed and other sessions were signed out.'
}

watch(() => session.value.data?.user?.id, load, { immediate: true })
</script>

<template>
  <UDashboardPanel id="profile">
    <template #header>
      <UDashboardNavbar title="Profile">
        <template #leading>
          <AppNavbarLeading />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <div><h1 class="text-2xl font-semibold tracking-tight">Account settings</h1><p class="mt-2 text-sm text-muted">Manage your personal details and sign-in methods.</p></div>
        <UCard>
          <template #header><div><h2 class="font-semibold">Profile</h2><p class="mt-1 text-sm text-muted">This information is visible to your teammates.</p></div></template>
          <form class="flex flex-col gap-5 sm:flex-row" @submit.prevent="updateProfile">
            <UAvatar :text="initials" size="3xl" />
            <div class="flex-1 space-y-4">
              <UFormField label="Name"><UInput v-model="name" autocomplete="name" class="w-full" /></UFormField>
              <UFormField label="Email"><UInput :model-value="session.data?.user?.email" disabled class="w-full" /></UFormField>
              <div class="flex items-center justify-between gap-3"><p class="text-sm" :class="profileError ? 'text-error' : 'text-success'">{{ profileError || profileFeedback }}</p><UButton type="submit" :loading="savingProfile">Save profile</UButton></div>
            </div>
          </form>
        </UCard>

        <UCard>
          <template #header><div><h2 class="font-semibold">Authentication methods</h2><p class="mt-1 text-sm text-muted">Accounts currently linked to your Argus profile.</p></div></template>
          <div class="divide-y divide-default">
            <div v-for="linkedAccount in accounts" :key="linkedAccount.id" class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span class="grid size-9 place-items-center rounded-lg bg-muted"><UIcon :name="linkedAccount.providerId === 'credential' ? 'i-lucide-key-round' : `i-simple-icons-${linkedAccount.providerId}`" class="size-4" /></span>
              <div class="min-w-0 flex-1"><p class="text-sm font-medium capitalize">{{ linkedAccount.providerId === 'credential' ? 'Email and password' : linkedAccount.providerId }}</p><p class="truncate text-xs text-muted">{{ linkedAccount.accountId }}</p></div>
              <UBadge color="success" variant="subtle">Connected</UBadge>
            </div>
          </div>
        </UCard>

        <UCard v-if="hasPassword">
          <template #header><div><h2 class="font-semibold">Change password</h2><p class="mt-1 text-sm text-muted">Changing it signs out your other sessions.</p></div></template>
          <form class="space-y-4" @submit.prevent="changePassword">
            <UFormField label="Current password"><UInput v-model="currentPassword" type="password" autocomplete="current-password" class="w-full" /></UFormField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="New password"><UInput v-model="newPassword" type="password" autocomplete="new-password" class="w-full" /></UFormField>
              <UFormField label="Confirm new password"><UInput v-model="confirmPassword" type="password" autocomplete="new-password" class="w-full" /></UFormField>
            </div>
            <div class="flex items-center justify-between gap-3"><p class="text-sm" :class="passwordError ? 'text-error' : 'text-success'">{{ passwordError || passwordFeedback }}</p><UButton type="submit" :loading="savingPassword">Change password</UButton></div>
          </form>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
