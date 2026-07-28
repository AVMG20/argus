<script setup lang="ts">
import { authClient } from '../lib/auth-client'

const { links } = useAppConfig()
const route = useRoute()

useSeoMeta({
  title: 'Sign in — Argus',
  description: 'Sign in to your self-hosted Argus instance.'
})

const invitedEmail = typeof route.query.email === 'string' ? route.query.email : ''
const invitationId = typeof route.query.invite === 'string' ? route.query.invite : ''

// The auth middleware appends the page someone was trying to reach. Only accept
// same-origin paths so the parameter cannot be used to bounce people off-site.
const redirect = computed(() => {
  const target = route.query.redirect
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return '/'
  return target
})

const destination = computed(() => invitationId
  ? `/onboarding?invite=${encodeURIComponent(invitationId)}`
  : redirect.value)

const mode = ref<'sign-in' | 'sign-up'>('sign-in')
const name = ref('')
const email = ref(invitedEmail)
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const pending = ref(false)

const isSignUp = computed(() => mode.value === 'sign-up')

// Already signed in — send them on instead of showing a form they do not need.
// For an invitation link that means the invitation itself, not the app root.
const session = authClient.useSession()
watch(() => session.value.data?.user?.id, (userId) => {
  if (userId) navigateTo(destination.value)
}, { immediate: true })

const highlights = [
  { icon: 'i-lucide-plug-zap', title: 'Sentry SDK compatible', text: 'Point the SDK you already ship at this instance and keep every integration.' },
  { icon: 'i-lucide-layers-3', title: 'Grouped into issues', text: 'Repeated exceptions collapse into one issue with the full stack trace and context.' },
  { icon: 'i-lucide-database', title: 'Stored in your Postgres', text: 'No third party, no quota, no telemetry leaving the server.' }
]

function switchMode() {
  mode.value = isSignUp.value ? 'sign-in' : 'sign-up'
  error.value = ''
}

async function submit() {
  pending.value = true
  error.value = ''
  const result = isSignUp.value
    ? await authClient.signUp.email({ name: name.value.trim(), email: email.value.trim(), password: password.value })
    : await authClient.signIn.email({ email: email.value.trim(), password: password.value })
  pending.value = false
  if (result.error) {
    error.value = result.error.message ?? 'Something went wrong.'
    return
  }
  await navigateTo(destination.value)
}
</script>

<template>
  <div class="grid min-h-screen bg-default lg:grid-cols-[1.05fr_1fr]">
    <!-- Brand panel -->
    <section class="relative hidden overflow-hidden border-r border-default bg-elevated/50 p-12 lg:flex lg:flex-col">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_20%_0%,var(--ui-primary)_0%,transparent_70%)] opacity-[0.14]" />
      <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--ui-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--ui-border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30 [mask-image:radial-gradient(60%_60%_at_30%_20%,black,transparent)]" />

      <div class="relative flex items-center gap-2 font-bold tracking-tight">
        <span class="grid size-8 place-items-center rounded-lg bg-neutral-950">
          <img
            src="/argus-logo.png"
            alt=""
            class="size-6 object-contain"
          >
        </span>
        Argus
      </div>

      <div class="relative my-auto max-w-lg">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge
            color="primary"
            variant="subtle"
            icon="i-lucide-scale"
          >
            MIT licensed
          </UBadge>
          <UBadge
            color="neutral"
            variant="subtle"
            icon="i-lucide-server"
          >
            Self-hosted
          </UBadge>
        </div>
        <h1 class="mt-6 text-4xl font-semibold tracking-[-0.03em]">
          Find the line that broke production.
        </h1>
        <p class="mt-4 text-lg leading-8 text-muted">
          Open source error tracking with a hundred eyes on your stack traces — and none on your data.
        </p>

        <div class="mt-10 space-y-5">
          <div
            v-for="item in highlights"
            :key="item.title"
            class="flex gap-3"
          >
            <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><UIcon
              :name="item.icon"
              class="size-4"
            /></span>
            <div>
              <p class="text-sm font-medium text-highlighted">
                {{ item.title }}
              </p>
              <p class="mt-1 text-sm leading-6 text-muted">
                {{ item.text }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="relative flex items-center gap-4 text-xs text-dimmed">
        <span>Free and open source forever.</span>
        <a
          :href="links.github"
          target="_blank"
          class="flex items-center gap-1.5 hover:text-highlighted"
        >
          <UIcon
            name="i-simple-icons-github"
            class="size-3.5"
          /> Source on GitHub
        </a>
      </div>
    </section>

    <!-- Form -->
    <section class="flex min-h-screen items-center justify-center p-6">
      <div class="w-full max-w-sm">
        <div class="mb-10 flex items-center gap-2 font-bold tracking-tight lg:hidden">
          <span class="grid size-8 place-items-center rounded-lg bg-neutral-950">
            <img
              src="/argus-logo.png"
              alt=""
              class="size-6 object-contain"
            >
          </span>
          Argus
        </div>

        <div class="mb-7">
          <h2 class="text-2xl font-semibold tracking-tight">
            {{ isSignUp ? 'Create your account' : 'Welcome back' }}
          </h2>
          <p class="mt-2 text-sm text-muted">
            {{ isSignUp ? 'Accounts live on this instance only — nothing is created anywhere else.' : 'Sign in to continue to your projects.' }}
          </p>
        </div>

        <UAlert
          v-if="invitedEmail"
          class="mb-5"
          color="primary"
          variant="subtle"
          icon="i-lucide-mail-open"
          title="You've been invited"
          :description="`Sign in or create an account as ${invitedEmail} to join the team.`"
        />

        <form
          class="space-y-4"
          @submit.prevent="submit"
        >
          <UFormField
            v-if="isSignUp"
            label="Name"
          >
            <UInput
              v-model="name"
              required
              autocomplete="name"
              placeholder="Ada Lovelace"
              icon="i-lucide-user-round"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Email">
            <UInput
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="you@company.com"
              icon="i-lucide-mail"
              class="w-full"
              :readonly="!!invitedEmail"
            />
          </UFormField>

          <UFormField
            label="Password"
            :hint="isSignUp ? 'At least 8 characters' : undefined"
          >
            <UInput
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              :autocomplete="isSignUp ? 'new-password' : 'current-password'"
              icon="i-lucide-lock"
              class="w-full"
            >
              <template #trailing>
                <UButton
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  color="neutral"
                  variant="link"
                  size="xs"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>
          </UFormField>

          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :description="error"
          />

          <UButton
            type="submit"
            block
            size="lg"
            :loading="pending"
            :trailing-icon="pending ? undefined : 'i-lucide-arrow-right'"
          >
            {{ isSignUp ? 'Create account' : 'Sign in' }}
          </UButton>
        </form>

        <p class="mt-6 text-center text-sm text-muted">
          {{ isSignUp ? 'Already have an account?' : 'First time on this instance?' }}
          <button
            class="font-medium text-primary hover:underline"
            type="button"
            @click="switchMode"
          >
            {{ isSignUp ? 'Sign in' : 'Create an account' }}
          </button>
        </p>

        <p class="mt-10 text-center text-xs text-dimmed lg:hidden">
          Open source error tracking, MIT licensed.
        </p>
      </div>
    </section>
  </div>
</template>
