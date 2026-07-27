<script setup lang="ts">
import { authClient } from '../../lib/auth-client'

const session = authClient.useSession()
const organizations = ref<any[]>([])
const name = ref('')
const pending = ref(false)
const error = ref('')
const activeOrganizationId = computed(() => session.value.data?.session?.activeOrganizationId || organizations.value[0]?.id)

async function loadOrganizations() {
  if (!session.value.data?.user) return
  organizations.value = (await authClient.organization.list()).data || []
  if (!organizations.value.length) await navigateTo('/onboarding')
}

async function createProject() {
  if (!activeOrganizationId.value || !name.value.trim()) return
  pending.value = true
  error.value = ''
  try {
    const project = await $fetch<any>('/api/projects', {
      method: 'POST',
      body: { organizationId: activeOrganizationId.value, name: name.value.trim() }
    })
    await navigateTo(`/projects/${project.id}/setup`)
  } catch (reason: any) {
    error.value = reason.data?.message || 'Could not create the project.'
  } finally {
    pending.value = false
  }
}

watch(() => session.value.data?.user?.id, loadOrganizations, { immediate: true })
</script>

<template>
  <UDashboardPanel id="new-project">
    <template #header>
      <UDashboardNavbar title="New project">
        <template #leading>
          <AppNavbarLeading />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="mx-auto w-full max-w-xl py-8">
        <div class="mb-8">
          <span class="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><UIcon name="i-lucide-box" class="size-5" /></span>
          <h1 class="mt-5 text-2xl font-semibold tracking-tight">Create a project</h1>
          <p class="mt-2 text-sm leading-6 text-muted">A project represents one deployed application. Argus detects SDK, runtime, browser, and release information from incoming events automatically.</p>
        </div>
        <UCard>
          <form class="space-y-5" @submit.prevent="createProject">
            <UFormField label="Project name" description="Use a name your team will recognize.">
              <UInput v-model="name" placeholder="Checkout web" autofocus class="w-full" />
            </UFormField>
            <UAlert v-if="error" color="error" variant="subtle" :description="error" />
            <div class="flex justify-end gap-2"><UButton to="/dashboard" color="neutral" variant="ghost">Cancel</UButton><UButton type="submit" :loading="pending" trailing-icon="i-lucide-arrow-right">Create and configure</UButton></div>
          </form>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
