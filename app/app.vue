<script setup>
const { restore } = useAppearance()

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: '/favicon.png' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Argus'
const description = 'Free, open source, self-hosted error tracking. Sentry SDK compatible.'
const route = useRoute()
const isAppRoute = computed(() => ['/dashboard', '/onboarding', '/profile', '/team', '/projects/', '/issues/', '/performance/'].some(path => route.path === path || route.path.startsWith(path)))

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})

onMounted(restore)
</script>

<template>
  <UApp>
    <UDashboardGroup
      v-if="isAppRoute"
      class="min-h-screen bg-default"
    >
      <AppSidebar />
      <main class="flex h-svh min-h-0 min-w-0 flex-1 overflow-hidden">
        <NuxtPage />
      </main>
    </UDashboardGroup>
    <NuxtPage v-else />
  </UApp>
</template>
