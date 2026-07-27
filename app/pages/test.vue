<script setup lang="ts">
type SentryBrowser = typeof import('@sentry/browser')

const dsn = 'http://e353c021e3c7497bbeced6f73f78db40@localhost:3000/sentry/1'
const sentry = shallowRef<SentryBrowser>()
const ready = ref(false)
const sending = ref(false)
const sentCount = ref(0)
const lastEventId = ref('')
const deliveryStatus = ref<number>()
const deliveryResponse = ref('')
const statusMessage = ref('Initializing the browser SDK…')
const lastMode = ref<'captured' | 'unhandled'>()

useSeoMeta({
  title: 'Argus SDK test',
  description: 'Send realistic captured and unhandled browser exceptions to the local Argus project.'
})

function browserContext() {
  return {
    browser: {
      name: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser',
      version: navigator.userAgent,
      type: 'browser'
    },
    device: {
      family: navigator.platform || 'Unknown',
      model: 'Desktop browser',
      brand: navigator.vendor || 'Unknown',
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      pixel_ratio: window.devicePixelRatio,
      type: 'device'
    },
    os: {
      name: navigator.platform || 'Unknown',
      type: 'os'
    },
    runtime: {
      name: 'browser',
      version: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages,
      online: navigator.onLine,
      type: 'runtime'
    }
  }
}

function testRequest() {
  return {
    url: window.location.href,
    method: 'GET',
    query_string: window.location.search.slice(1),
    headers: {
      'Referer': document.referrer || `${window.location.origin}/`,
      'User-Agent': navigator.userAgent,
      'Accept-Language': navigator.languages.join(', '),
      'Authorization': 'Bearer argus-synthetic-test-token',
      'Cookie': 'theme=dark; argus_test_session=synthetic-session-value'
    },
    cookies: {
      theme: 'dark',
      argus_test_session: 'synthetic-session-value'
    },
    data: {
      testPage: '/test',
      trigger: lastMode.value,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    }
  }
}

function createCheckoutFailure() {
  function parseCustomerResponse() {
    const response: { customer?: { id: string } } = {}
    return response.customer!.id
  }

  function loadCustomer() {
    return parseCustomerResponse()
  }

  function submitCheckout() {
    return loadCustomer()
  }

  try {
    submitCheckout()
  } catch (cause) {
    const error = new Error('Could not confirm checkout for cart cart_argus_test', { cause })
    error.name = 'CheckoutTestError'
    throw error
  }
}

function addTestBreadcrumbs(mode: 'captured' | 'unhandled') {
  if (!sentry.value) return

  sentry.value.addBreadcrumb({
    type: 'navigation',
    category: 'navigation',
    level: 'info',
    data: { from: '/', to: '/test' },
    timestamp: Date.now() / 1000 - 8
  })
  sentry.value.addBreadcrumb({
    type: 'http',
    category: 'fetch',
    level: 'info',
    message: 'GET /api/cart/cart_argus_test',
    data: { method: 'GET', status_code: 200, duration_ms: 184 },
    timestamp: Date.now() / 1000 - 4
  })
  sentry.value.addBreadcrumb({
    type: 'user',
    category: 'ui.click',
    level: 'info',
    message: `button[data-test="${mode}"]`,
    data: { mode },
    timestamp: Date.now() / 1000
  })
}

function configureScope(mode: 'captured' | 'unhandled') {
  if (!sentry.value) return

  sentry.value.setUser({
    id: 'argus-test-user-1042',
    email: 'test.user@example.test',
    username: 'argus-test-user',
    ip_address: '203.0.113.42'
  })
  sentry.value.setTags({
    source: 'argus-test-page',
    test_mode: mode,
    feature: 'checkout',
    region: 'local-development'
  })
  sentry.value.setContext('test_run', {
    mode,
    sentAt: new Date().toISOString(),
    page: '/test',
    synthetic: true
  })
  sentry.value.setContext('cart', {
    id: 'cart_argus_test',
    itemCount: 3,
    total: 129.95,
    currency: 'EUR',
    featureFlags: ['new-checkout', 'express-payments']
  })
  addTestBreadcrumbs(mode)
}

async function sendCapturedException() {
  if (!sentry.value || sending.value) return

  sending.value = true
  lastMode.value = 'captured'
  deliveryStatus.value = undefined
  deliveryResponse.value = ''
  statusMessage.value = 'Capturing and flushing the exception…'
  configureScope('captured')

  try {
    createCheckoutFailure()
  } catch (error) {
    lastEventId.value = sentry.value.captureException(error, {
      level: 'error',
      tags: { handled_by_test_page: 'true' },
      extra: {
        action: 'confirm-checkout',
        attempt: sentCount.value + 1,
        paymentProvider: 'stripe',
        discountCode: 'WELCOME10'
      }
    })
  }

  const flushed = await sentry.value.flush(3000)
  sentCount.value += 1
  sending.value = false
  if (deliveryStatus.value === 202) {
    statusMessage.value = 'Captured exception accepted by Argus. Open project 1 to inspect it.'
  } else if (deliveryStatus.value) {
    statusMessage.value = `Argus responded with HTTP ${deliveryStatus.value}. Check the response below.`
  } else {
    statusMessage.value = flushed
      ? 'The SDK queue drained, but no Argus HTTP response was observed.'
      : 'The SDK did not finish sending within three seconds.'
  }
}

function throwUnhandledException() {
  if (!sentry.value || sending.value) return

  lastMode.value = 'unhandled'
  configureScope('unhandled')
  sentCount.value += 1
  statusMessage.value = 'Throwing an unhandled exception. The Nuxt development overlay may appear.'

  window.setTimeout(() => {
    createCheckoutFailure()
  }, 50)
}

onMounted(async () => {
  const sdk = await import('@sentry/browser')
  sentry.value = sdk

  sdk.init({
    dsn,
    environment: 'local-test',
    release: 'argus-test-page@1.0.0',
    dist: 'browser',
    sendDefaultPii: false,
    attachStacktrace: true,
    maxBreadcrumbs: 50,
    transport(options) {
      return sdk.makeFetchTransport(options, async (input, init) => {
        try {
          const response = await window.fetch(input, init)
          deliveryStatus.value = response.status
          deliveryResponse.value = await response.clone().text()
          return response
        } catch (error) {
          deliveryResponse.value = error instanceof Error ? error.message : String(error)
          throw error
        }
      })
    },
    beforeSend(event) {
      event.request = testRequest()
      event.contexts = {
        ...event.contexts,
        ...browserContext()
      }
      event.extra = {
        ...event.extra,
        pagePurpose: 'Argus end-to-end SDK verification',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return event
    }
  })

  ready.value = true
  statusMessage.value = 'SDK ready. Choose a test mode below.'
})
</script>

<template>
  <div class="min-h-screen bg-default">
    <header class="border-b border-default bg-default/80 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-5xl items-center gap-3 px-6">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 font-bold tracking-tight"
        >
          <span class="grid size-8 place-items-center rounded-lg bg-primary text-inverted">
            <UIcon
              name="i-lucide-scan-eye"
              class="size-4"
            />
          </span>
          Argus
        </NuxtLink>
        <UBadge
          color="warning"
          variant="subtle"
        >
          Local test page
        </UBadge>
        <UButton
          to="/dashboard"
          label="Open dashboard"
          trailing-icon="i-lucide-arrow-right"
          color="neutral"
          variant="ghost"
          class="ml-auto"
        />
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <div class="max-w-3xl">
        <UBadge
          :color="ready ? 'success' : 'neutral'"
          :icon="ready ? 'i-lucide-circle-check' : 'i-lucide-loader-circle'"
          variant="subtle"
        >
          {{ ready ? 'SDK connected' : 'Connecting SDK' }}
        </UBadge>
        <h1 class="mt-5 text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
          Test Argus with a real browser exception
        </h1>
        <p class="mt-4 text-base leading-7 text-muted">
          These controls use the official Sentry browser SDK and send a realistic chained checkout failure to your local Argus project.
        </p>
      </div>

      <UAlert
        class="mt-8"
        color="warning"
        variant="subtle"
        icon="i-lucide-shield-check"
        title="Safe synthetic data"
        description="The page sends your real browser, viewport, language, URL, stack, and runtime details. Cookie, authorization, user, IP, and checkout values are synthetic test fixtures."
      />

      <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section class="space-y-6">
          <UCard>
            <template #header>
              <div class="flex items-start gap-3">
                <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <UIcon
                    name="i-lucide-bug"
                    class="size-5"
                  />
                </span>
                <div>
                  <h2 class="font-semibold text-highlighted">
                    Choose how the error is raised
                  </h2>
                  <p class="mt-1 text-sm text-muted">
                    Both options produce the same nested application stack.
                  </p>
                </div>
              </div>
            </template>

            <div class="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                data-test="captured"
                class="rounded-xl border border-default bg-elevated p-5 text-left transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!ready || sending"
                @click="sendCapturedException"
              >
                <span class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <UIcon
                    name="i-lucide-send"
                    class="size-4"
                  />
                </span>
                <span class="mt-4 block font-semibold text-highlighted">Captured exception</span>
                <span class="mt-2 block text-sm leading-6 text-muted">
                  Catches the error, sends it explicitly, and waits for delivery confirmation.
                </span>
              </button>

              <button
                type="button"
                data-test="unhandled"
                class="rounded-xl border border-default bg-elevated p-5 text-left transition hover:border-error hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!ready || sending"
                @click="throwUnhandledException"
              >
                <span class="grid size-9 place-items-center rounded-lg bg-error/10 text-error">
                  <UIcon
                    name="i-lucide-zap"
                    class="size-4"
                  />
                </span>
                <span class="mt-4 block font-semibold text-highlighted">Unhandled exception</span>
                <span class="mt-2 block text-sm leading-6 text-muted">
                  Throws outside Vue so the SDK’s global browser handler captures it naturally.
                </span>
              </button>
            </div>

            <template #footer>
              <div class="flex items-start gap-3">
                <UIcon
                  :name="sending ? 'i-lucide-loader-circle' : lastEventId ? 'i-lucide-circle-check' : 'i-lucide-info'"
                  class="mt-0.5 size-4 shrink-0"
                  :class="sending ? 'animate-spin text-primary' : lastEventId ? 'text-success' : 'text-muted'"
                />
                <div class="min-w-0">
                  <p class="text-sm text-highlighted">
                    {{ statusMessage }}
                  </p>
                  <p
                    v-if="lastEventId"
                    class="mt-1 break-all font-mono text-xs text-muted"
                  >
                    Event ID: {{ lastEventId }}
                  </p>
                  <p
                    v-if="deliveryStatus"
                    class="mt-1 break-all font-mono text-xs text-muted"
                  >
                    HTTP {{ deliveryStatus }}<template v-if="deliveryResponse">
                      · {{ deliveryResponse }}
                    </template>
                  </p>
                </div>
              </div>
            </template>
          </UCard>

          <UCard
            title="What the event includes"
            description="Designed to exercise every major section of the issue detail page."
          >
            <div class="grid gap-3 sm:grid-cols-2">
              <div
                v-for="item in [
                  ['i-lucide-list-tree', 'Nested exception cause and full browser stack'],
                  ['i-lucide-route', 'Navigation, request, and interaction breadcrumbs'],
                  ['i-lucide-globe-2', 'URL, method, headers, and synthetic cookies'],
                  ['i-lucide-user-round', 'Synthetic affected user and IP address'],
                  ['i-lucide-laptop', 'Browser, device, viewport, OS, and language'],
                  ['i-lucide-tags', 'Release, environment, tags, contexts, and extra data']
                ]"
                :key="item[1]"
                class="flex items-start gap-3 rounded-lg border border-default bg-muted/40 p-3"
              >
                <UIcon
                  :name="item[0]"
                  class="mt-0.5 size-4 shrink-0 text-primary"
                />
                <span class="text-sm leading-5 text-muted">{{ item[1] }}</span>
              </div>
            </div>
          </UCard>
        </section>

        <aside class="space-y-6">
          <UCard title="Destination">
            <dl class="space-y-4 text-xs">
              <div>
                <dt class="text-dimmed">
                  DSN
                </dt>
                <dd class="mt-1 break-all font-mono leading-5 text-highlighted">
                  {{ dsn }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-dimmed">
                  Project
                </dt>
                <dd class="font-medium text-highlighted">
                  1
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-dimmed">
                  Environment
                </dt>
                <dd class="font-medium text-highlighted">
                  local-test
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-dimmed">
                  Events sent
                </dt>
                <dd class="font-medium text-highlighted">
                  {{ sentCount }}
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard title="Expected issue">
            <UBadge
              color="error"
              variant="subtle"
            >
              CheckoutTestError
            </UBadge>
            <p class="mt-3 text-sm font-medium leading-6 text-highlighted">
              Could not confirm checkout for cart cart_argus_test
            </p>
            <p class="mt-2 font-mono text-xs text-muted">
              createCheckoutFailure in test.vue
            </p>
          </UCard>
        </aside>
      </div>
    </main>
  </div>
</template>
