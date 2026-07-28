<script setup lang="ts">
type RequestError = { data?: { message?: string }, statusMessage?: string }

const props = defineProps<{
  projectId: string
  projectName?: string
}>()

const open = ref(false)
const confirmation = ref('')
const deleting = ref(false)
const deleteError = ref('')

const confirmed = computed(() => Boolean(props.projectName) && confirmation.value === props.projectName)

function openModal() {
  confirmation.value = ''
  deleteError.value = ''
  open.value = true
}

async function deleteProject() {
  if (!confirmed.value || deleting.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/projects/${props.projectId}`, { method: 'DELETE' })
    await navigateTo('/')
  } catch (reason: unknown) {
    const requestError = reason as RequestError
    deleteError.value = requestError.data?.message || requestError.statusMessage || 'Could not delete the project.'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UButton
    icon="i-lucide-trash-2"
    color="error"
    variant="ghost"
    size="sm"
    aria-label="Delete project"
    @click="openModal"
  />

  <UModal
    v-model:open="open"
    title="Delete project"
    :description="`This permanently deletes ${projectName || 'this project'} and all of its issues, events and traces.`"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          description="This action cannot be undone."
        />
        <UFormField :label="`Type ${projectName || 'the project name'} to confirm`">
          <UInput
            v-model="confirmation"
            :placeholder="projectName"
            autocomplete="off"
            class="w-full"
          />
        </UFormField>
        <p
          v-if="deleteError"
          class="text-sm text-error"
        >
          {{ deleteError }}
        </p>
      </div>
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
          color="error"
          icon="i-lucide-trash-2"
          label="Delete project"
          :disabled="!confirmed"
          :loading="deleting"
          @click="deleteProject"
        />
      </div>
    </template>
  </UModal>
</template>
