<script setup lang="ts">
const route = useRoute()
const requestUrl = useRequestURL()
const { data } = await useFetch<{ project: { publicKey: string, sentryProjectId: number, name: string } }>(() => `/api/projects/${route.params.id}`)
const copied = ref('')
const sending = ref(false)
const sent = ref(false)
const selectedSdk = ref('browser')

const dsn = computed(() => {
  if (!data.value?.project) return ''
  const authenticatedOrigin = requestUrl.origin.replace('://', `://${data.value.project.publicKey}@`)
  return `${authenticatedOrigin}/sentry/${data.value.project.sentryProjectId}`
})

type SdkItem = {
  label: string
  value: string
  icon: string
  description: string
  install: string
  setup: (projectDsn: string) => string
}

const javascriptSetup = (packageName: string) => (projectDsn: string) => `import * as Sentry from '${packageName}'

Sentry.init({
  dsn: '${projectDsn}',
  environment: 'production'
})`

const sdkItems: SdkItem[] = [
  {
    label: 'Browser JavaScript',
    value: 'browser',
    icon: 'i-lucide-globe',
    description: 'Vanilla JavaScript and browser applications',
    install: 'npm install @sentry/browser',
    setup: javascriptSetup('@sentry/browser')
  },
  {
    label: 'React',
    value: 'react',
    icon: 'i-simple-icons-react',
    description: 'React applications',
    install: 'npm install @sentry/react',
    setup: javascriptSetup('@sentry/react')
  },
  {
    label: 'Vue',
    value: 'vue',
    icon: 'i-simple-icons-vuedotjs',
    description: 'Vue applications',
    install: 'npm install @sentry/vue',
    setup: javascriptSetup('@sentry/vue')
  },
  {
    label: 'Nuxt',
    value: 'nuxt',
    icon: 'i-simple-icons-nuxtdotjs',
    description: 'Nuxt applications',
    install: 'npm install @sentry/nuxt',
    setup: javascriptSetup('@sentry/nuxt')
  },
  {
    label: 'Next.js',
    value: 'next',
    icon: 'i-simple-icons-nextdotjs',
    description: 'Next.js applications',
    install: 'npm install @sentry/nextjs',
    setup: javascriptSetup('@sentry/nextjs')
  },
  {
    label: 'Svelte',
    value: 'svelte',
    icon: 'i-simple-icons-svelte',
    description: 'Svelte and SvelteKit applications',
    install: 'npm install @sentry/svelte',
    setup: javascriptSetup('@sentry/svelte')
  },
  {
    label: 'Angular',
    value: 'angular',
    icon: 'i-simple-icons-angular',
    description: 'Angular applications',
    install: 'npm install @sentry/angular',
    setup: javascriptSetup('@sentry/angular')
  },
  {
    label: 'Node.js',
    value: 'node',
    icon: 'i-simple-icons-nodedotjs',
    description: 'Node.js servers and workers',
    install: 'npm install @sentry/node',
    setup: javascriptSetup('@sentry/node')
  },
  {
    label: 'PHP',
    value: 'php',
    icon: 'i-simple-icons-php',
    description: 'Plain PHP applications',
    install: 'composer require sentry/sentry',
    setup: projectDsn => `<?php

\\Sentry\\init([
  'dsn' => '${projectDsn}',
  'environment' => 'production',
]);`
  },
  {
    label: 'Laravel',
    value: 'laravel',
    icon: 'i-simple-icons-laravel',
    description: 'Laravel applications',
    install: 'composer require sentry/sentry-laravel',
    setup: projectDsn => `# .env
SENTRY_LARAVEL_DSN=${projectDsn}
SENTRY_ENVIRONMENT=production`
  },
  {
    label: 'Symfony',
    value: 'symfony',
    icon: 'i-simple-icons-symfony',
    description: 'Symfony applications',
    install: 'composer require sentry/sentry-symfony',
    setup: projectDsn => `# .env.local
SENTRY_DSN=${projectDsn}

# config/packages/sentry.yaml
sentry:
  dsn: '%env(SENTRY_DSN)%'`
  },
  {
    label: 'Python',
    value: 'python',
    icon: 'i-simple-icons-python',
    description: 'Plain Python applications',
    install: 'pip install --upgrade sentry-sdk',
    setup: projectDsn => `import sentry_sdk

sentry_sdk.init(
    dsn="${projectDsn}",
    environment="production",
)`
  },
  {
    label: 'Django',
    value: 'django',
    icon: 'i-simple-icons-django',
    description: 'Django applications',
    install: 'pip install --upgrade "sentry-sdk[django]"',
    setup: projectDsn => `# settings.py
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

sentry_sdk.init(
    dsn="${projectDsn}",
    integrations=[DjangoIntegration()],
    environment="production",
)`
  },
  {
    label: 'Flask',
    value: 'flask',
    icon: 'i-simple-icons-flask',
    description: 'Flask applications',
    install: 'pip install --upgrade "sentry-sdk[flask]"',
    setup: projectDsn => `import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn="${projectDsn}",
    integrations=[FlaskIntegration()],
    environment="production",
)`
  },
  {
    label: 'Ruby',
    value: 'ruby',
    icon: 'i-simple-icons-ruby',
    description: 'Plain Ruby applications',
    install: 'bundle add sentry-ruby',
    setup: projectDsn => `require "sentry-ruby"

Sentry.init do |config|
  config.dsn = "${projectDsn}"
  config.environment = "production"
end`
  },
  {
    label: 'Ruby on Rails',
    value: 'rails',
    icon: 'i-simple-icons-rubyonrails',
    description: 'Rails applications',
    install: 'bundle add sentry-ruby sentry-rails',
    setup: projectDsn => `# config/initializers/sentry.rb
Sentry.init do |config|
  config.dsn = "${projectDsn}"
  config.environment = "production"
end`
  },
  {
    label: 'Go',
    value: 'go',
    icon: 'i-simple-icons-go',
    description: 'Go services and command-line applications',
    install: 'go get github.com/getsentry/sentry-go',
    setup: projectDsn => `package main

import "github.com/getsentry/sentry-go"

func main() {
  sentry.Init(sentry.ClientOptions{
    Dsn: "${projectDsn}",
    Environment: "production",
  })
}`
  },
  {
    label: '.NET',
    value: 'dotnet',
    icon: 'i-simple-icons-dotnet',
    description: '.NET applications',
    install: 'dotnet add package Sentry',
    setup: projectDsn => `using Sentry;

using (SentrySdk.Init(options =>
{
    options.Dsn = "${projectDsn}";
    options.Environment = "production";
}))
{
    // Run your application
}`
  }
]

const selectedSdkConfig = computed(() => sdkItems.find(item => item.value === selectedSdk.value) || sdkItems[0]!)
const installCommand = computed(() => selectedSdkConfig.value.install)
const setupCode = computed(() => selectedSdkConfig.value.setup(dsn.value))

/** Browsers cannot read source files, so these never send the code around a frame. */
const browserOnlySdks = new Set(['browser', 'react', 'vue', 'svelte', 'angular', 'dotnet'])
const splitContextSdks = new Set(['nuxt', 'next'])

const sourceContextNote = computed(() => {
  if (browserOnlySdks.has(selectedSdk.value)) return 'Stack frames will show file, line and column. Upload source maps below to turn the minified positions back into your original code.'
  if (splitContextSdks.has(selectedSdk.value)) return 'Server-side errors include the code around each frame by default. Browser errors are minified — upload source maps below and Argus resolves them for you.'
  return 'Code snippets around each frame are sent by default. Keep your source files deployed next to the build so the SDK can read them.'
})

type SourceMapGuide = { label: string, config: string, dir: string }

/**
 * Where each toolchain writes its maps and how to emit them without shipping them.
 * "hidden" keeps the .map files out of the browser by dropping the sourceMappingURL
 * comment; Argus only needs the files at upload time.
 */
const viteGuide: SourceMapGuide = {
  label: 'vite.config.ts',
  config: `export default defineConfig({
  build: { sourcemap: 'hidden' }
})`,
  dir: 'dist'
}

const sourceMapGuides: Record<string, SourceMapGuide> = {
  nuxt: {
    label: 'nuxt.config.ts',
    config: `export default defineNuxtConfig({
  sourcemap: { client: 'hidden' }
})`,
    dir: '.output/public'
  },
  next: {
    label: 'next.config.js',
    config: `module.exports = {
  productionBrowserSourceMaps: true
}`,
    dir: '.next/static'
  },
  angular: {
    label: 'angular.json',
    config: `"sourceMap": {
  "scripts": true,
  "hidden": true
}`,
    dir: 'dist'
  },
  browser: viteGuide,
  react: viteGuide,
  vue: viteGuide,
  svelte: viteGuide
}

/** Only bundled front-end code is minified; every other runtime reports real paths. */
const needsSourceMaps = computed(() => selectedSdk.value in sourceMapGuides)
const sourceMapGuide = computed(() => sourceMapGuides[selectedSdk.value] || viteGuide)

const { data: sourceMaps, refresh: refreshSourceMaps } = await useFetch<{
  // `size` is a bigint sum, so it arrives as a string.
  releases: Array<{ release: string | null, files: number, size: string, uploadedAt: string }>
  token: { value: string | null, createdAt: string, lastUsedAt: string | null } | null
  permissions: { canManageToken: boolean }
}>(() => `/api/projects/${route.params.id}/sourcemaps`)

const tokenPending = ref(false)
const tokenVisible = ref(false)

const uploadToken = computed(() => sourceMaps.value?.token?.value || '')
const maskedToken = computed(() => uploadToken.value ? `${uploadToken.value.slice(0, 12)}${'•'.repeat(18)}` : '')

/** A member without the role to read the token still needs to know one exists. */
const tokenNotice = computed(() => sourceMaps.value?.token
  ? 'This project has an upload token. Only an owner or admin of this team can read it.'
  : 'Ask an owner or admin of this team to create the upload token.')

const uploadCommand = computed(() => `# Run after the production build, from your project root.
set -e

DIR=${sourceMapGuide.value.dir}
RELEASE=$(git rev-parse --short HEAD)

find "$DIR" -name '*.map' | while IFS= read -r map; do
  curl -sSf -X POST "${requestUrl.origin}/api/projects/${route.params.id}/sourcemaps" \\
    -H "Authorization: Bearer ${uploadToken.value || '<upload-token>'}" \\
    -F "release=$RELEASE" \\
    -F "file=@$map;filename=\${map#$DIR/}"
done

# Optional: keep the maps off your web server once Argus has them. "set -e" above means
# this is skipped when an upload failed, so the only copy is never deleted for nothing.
find "$DIR" -name '*.map' -delete`)

async function manageToken() {
  tokenPending.value = true
  try {
    await $fetch(`/api/projects/${route.params.id}/upload-token`, { method: 'POST' })
    await refreshSourceMaps()
    tokenVisible.value = true
  } finally {
    tokenPending.value = false
  }
}

async function copy(value: string, label: string) {
  await navigator.clipboard.writeText(value)
  copied.value = label
  setTimeout(() => copied.value = '', 1600)
}

async function sendTestEvent() {
  if (!data.value) return
  sending.value = true
  const now = Date.now()
  await $fetch(`/api/store/${data.value.project.publicKey}`, {
    method: 'POST',
    body: {
      event_id: crypto.randomUUID().replaceAll('-', ''),
      timestamp: new Date(now).toISOString(),
      platform: 'javascript',
      level: 'error',
      logger: 'argus.setup',
      transaction: '/checkout/confirm',
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'Cannot read properties of undefined (reading \'id\')',
            module: 'checkout',
            mechanism: {
              type: 'generic',
              handled: true,
              description: 'The checkout API returned an incomplete customer object.'
            },
            stacktrace: {
              frames: [
                {
                  filename: 'node_modules/vue/dist/vue.runtime.esm-bundler.js',
                  abs_path: '/app/node_modules/vue/dist/vue.runtime.esm-bundler.js',
                  module: 'vue.runtime.esm-bundler',
                  function: 'callWithErrorHandling',
                  lineno: 199,
                  colno: 19,
                  in_app: false
                },
                {
                  filename: 'src/composables/useCheckout.ts',
                  abs_path: '/app/src/composables/useCheckout.ts',
                  module: 'checkout',
                  function: 'loadCustomer',
                  lineno: 48,
                  colno: 22,
                  in_app: true,
                  vars: { customer: 'undefined', cartId: '"cart_9d31"' },
                  pre_context: [
                    '  const response = await checkoutApi.getCustomer(cartId)',
                    '  const customer = response.data.customer',
                    ''
                  ],
                  context_line: '  return customer.id',
                  post_context: [
                    '}',
                    '',
                    'export async function confirmCheckout() {'
                  ]
                }
              ]
            }
          },
          {
            type: 'CheckoutError',
            value: 'Could not confirm checkout for cart cart_9d31',
            module: 'checkout',
            mechanism: {
              type: 'auto.browser.global_handlers.onunhandledrejection',
              handled: false,
              data: { source: 'unhandledrejection' }
            },
            stacktrace: {
              frames: [
                {
                  filename: 'src/pages/checkout/confirm.vue',
                  abs_path: 'https://shop.example.test/_nuxt/confirm.js',
                  function: 'onConfirm',
                  lineno: 87,
                  colno: 11,
                  in_app: true,
                  vars: { cartId: '"cart_9d31"', paymentStatus: '"authorized"' },
                  pre_context: [
                    'async function onConfirm() {',
                    '  submitting.value = true',
                    '  try {'
                  ],
                  context_line: '    await confirmCheckout(cart.value.id)',
                  post_context: [
                    '    router.push("/checkout/success")',
                    '  } finally {',
                    '    submitting.value = false'
                  ]
                }
              ]
            }
          }
        ]
      },
      environment: 'development',
      release: 'storefront@2.8.0',
      dist: '20260726.1',
      server_name: 'web-eu-03',
      tags: {
        source: 'setup-page',
        feature: 'checkout',
        region: 'eu-west-1',
        browser: 'Chrome 140.0'
      },
      user: {
        id: 'usr_demo_1042',
        email: 'demo.customer@example.test',
        username: 'demo-customer',
        ip_address: '203.0.113.42',
        subscription: 'pro'
      },
      request: {
        url: 'https://shop.example.test/checkout/confirm?cart=cart_9d31',
        method: 'POST',
        query_string: 'cart=cart_9d31',
        headers: {
          'Referer': 'https://shop.example.test/checkout',
          'User-Agent': navigator.userAgent,
          'Accept-Language': navigator.language,
          'Authorization': 'Bearer demo-secret-token',
          'Cookie': 'theme=dark; session=demo-session-token'
        },
        cookies: {
          theme: 'dark',
          session: 'demo-session-token'
        },
        data: {
          cartId: 'cart_9d31',
          paymentProvider: 'stripe',
          discountCode: 'WELCOME10'
        }
      },
      contexts: {
        browser: {
          name: 'Chrome',
          version: '140.0.0',
          type: 'browser'
        },
        device: {
          family: 'Mac',
          model: 'MacBook Pro',
          brand: 'Apple',
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
          type: 'device'
        },
        os: {
          name: 'macOS',
          version: '15.5',
          type: 'os'
        },
        runtime: {
          name: 'browser',
          version: navigator.userAgent,
          type: 'runtime'
        },
        trace: {
          trace_id: crypto.randomUUID().replaceAll('-', ''),
          span_id: crypto.randomUUID().replaceAll('-', '').slice(0, 16),
          op: 'ui.action.submit',
          status: 'internal_error'
        }
      },
      breadcrumbs: {
        values: [
          {
            timestamp: new Date(now - 12500).toISOString(),
            type: 'navigation',
            category: 'navigation',
            level: 'info',
            data: { from: '/cart', to: '/checkout' }
          },
          {
            timestamp: new Date(now - 7200).toISOString(),
            type: 'http',
            category: 'fetch',
            level: 'info',
            message: 'GET /api/cart/cart_9d31',
            data: { method: 'GET', status_code: 200, duration_ms: 183 }
          },
          {
            timestamp: new Date(now - 1800).toISOString(),
            type: 'user',
            category: 'ui.click',
            level: 'info',
            message: 'button[data-action="confirm-checkout"]'
          },
          {
            timestamp: new Date(now - 340).toISOString(),
            type: 'http',
            category: 'fetch',
            level: 'error',
            message: 'POST /api/checkout/confirm',
            data: { method: 'POST', status_code: 500, duration_ms: 329 }
          }
        ]
      },
      sdk: {
        name: 'sentry.javascript.browser',
        version: '9.38.0',
        integrations: ['BrowserApiErrors', 'Breadcrumbs', 'GlobalHandlers'],
        packages: [{ name: 'npm:@sentry/browser', version: '9.38.0' }]
      },
      modules: {
        'vue': '3.5.18',
        'nuxt': '4.4.8',
        '@sentry/browser': '9.38.0'
      },
      extra: {
        cart: { id: 'cart_9d31', itemCount: 3, total: 129.95, currency: 'EUR' },
        featureFlags: ['new-checkout', 'express-payments']
      }
    }
  })
  sending.value = false
  sent.value = true
}
</script>

<template>
  <UDashboardPanel id="project-setup">
    <template #header>
      <UDashboardNavbar title="SDK setup">
        <template #leading>
          <AppNavbarLeading
            :back-to="`/projects/${route.params.id}`"
            back-label="Back to issues"
          />
        </template>
        <template #right>
          <UButton
            :to="`/projects/${route.params.id}`"
            color="neutral"
            variant="outline"
            label="View issues"
            trailing-icon="i-lucide-arrow-right"
          />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="mx-auto w-full max-w-4xl">
        <div class="mb-8">
          <UBadge
            color="neutral"
            variant="subtle"
          >
            {{ data?.project.name }}
          </UBadge>
          <h1 class="mt-4 text-2xl font-semibold tracking-tight">
            Connect your application
          </h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Argus accepts the standard Sentry envelope format. Keep the SDK you already use and point it at this project’s DSN.
          </p>
        </div>

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div class="space-y-5">
            <UCard>
              <template #header>
                <div class="flex items-center gap-3">
                  <span class="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-inverted">1</span><div>
                    <h2 class="font-semibold">
                      Choose your SDK instructions
                    </h2><p class="text-sm text-muted">
                      This does not change the project or stored event data.
                    </p>
                  </div>
                </div>
              </template>
              <USelectMenu
                v-model="selectedSdk"
                :items="sdkItems"
                value-key="value"
                label-key="label"
                :search-input="{ placeholder: 'Search languages and frameworks…' }"
                class="w-full"
              />
              <p class="mt-3 flex items-center gap-2 text-sm text-muted">
                <UIcon
                  :name="selectedSdkConfig.icon"
                  class="size-4"
                />
                {{ selectedSdkConfig.description }}
              </p>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center gap-3">
                  <span class="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-inverted">2</span><div>
                    <h2 class="font-semibold">
                      Install the SDK
                    </h2><p class="text-sm text-muted">
                      Run this in your application.
                    </p>
                  </div>
                </div>
              </template>
              <div class="flex items-center gap-2 rounded-lg border border-default bg-muted p-4">
                <code class="min-w-0 flex-1 overflow-x-auto font-mono text-sm text-highlighted">{{ installCommand }}</code>
                <UButton
                  :icon="copied === 'install' ? 'i-lucide-check' : 'i-lucide-copy'"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Copy install command"
                  @click="copy(installCommand, 'install')"
                />
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center gap-3">
                  <span class="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-inverted">3</span><div>
                    <h2 class="font-semibold">
                      Initialize Argus
                    </h2><p class="text-sm text-muted">
                      Add this near your application entry point.
                    </p>
                  </div>
                </div>
              </template>
              <div class="relative rounded-lg border border-default bg-muted p-4">
                <pre class="overflow-x-auto font-mono text-xs leading-6 text-highlighted">{{ setupCode }}</pre>
                <UButton
                  :icon="copied === 'setup' ? 'i-lucide-check' : 'i-lucide-copy'"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  class="absolute right-3 top-3"
                  aria-label="Copy setup code"
                  @click="copy(setupCode, 'setup')"
                />
              </div>
              <p class="mt-3 flex items-start gap-2 text-xs leading-5 text-muted">
                <UIcon
                  name="i-lucide-code"
                  class="mt-0.5 size-3.5 shrink-0"
                />
                {{ sourceContextNote }}
              </p>
            </UCard>

            <UCard id="source-maps">
              <template #header>
                <div class="flex items-center gap-3">
                  <span class="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-inverted">4</span><div>
                    <h2 class="font-semibold">
                      Upload source maps
                    </h2><p class="text-sm text-muted">
                      Optional. Turns minified browser frames back into your original code.
                    </p>
                  </div>
                </div>
              </template>

              <UAlert
                v-if="!needsSourceMaps"
                color="neutral"
                variant="subtle"
                icon="i-lucide-info"
                title="Not needed for this SDK"
                :description="`${selectedSdkConfig.label} runs your source directly, so frames already point at real files. This step only applies to bundled browser code — set it up here if the same project also reports errors from a JavaScript front end.`"
                :ui="{ title: 'text-sm', description: 'text-xs' }"
                class="mb-4"
              />

              <div class="space-y-4">
                <div>
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-dimmed">
                    1 · Build with source maps
                  </p>
                  <div class="relative rounded-lg border border-default bg-muted p-4">
                    <p class="mb-2 font-mono text-[11px] text-dimmed">
                      {{ sourceMapGuide.label }}
                    </p>
                    <pre class="overflow-x-auto font-mono text-xs leading-6 text-highlighted">{{ sourceMapGuide.config }}</pre>
                    <UButton
                      :icon="copied === 'sourcemap-config' ? 'i-lucide-check' : 'i-lucide-copy'"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      class="absolute right-3 top-3"
                      aria-label="Copy source map config"
                      @click="copy(sourceMapGuide.config, 'sourcemap-config')"
                    />
                  </div>
                  <p class="mt-2 text-xs leading-5 text-muted">
                    <code class="font-mono">hidden</code> generates the maps without linking them from your bundle, so visitors cannot read your source — only this upload can.
                  </p>
                </div>

                <div>
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-dimmed">
                    2 · Upload token
                  </p>
                  <div
                    v-if="uploadToken"
                    class="flex items-center gap-2 rounded-lg border border-default bg-muted p-3"
                  >
                    <code class="min-w-0 flex-1 overflow-x-auto font-mono text-xs text-highlighted">{{ tokenVisible ? uploadToken : maskedToken }}</code>
                    <UButton
                      :icon="tokenVisible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :aria-label="tokenVisible ? 'Hide token' : 'Reveal token'"
                      @click="tokenVisible = !tokenVisible"
                    />
                    <UButton
                      :icon="copied === 'token' ? 'i-lucide-check' : 'i-lucide-copy'"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      aria-label="Copy upload token"
                      @click="copy(uploadToken, 'token')"
                    />
                    <UButton
                      v-if="sourceMaps?.permissions.canManageToken"
                      icon="i-lucide-refresh-cw"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :loading="tokenPending"
                      aria-label="Rotate upload token"
                      @click="manageToken"
                    />
                  </div>
                  <div v-else>
                    <UButton
                      v-if="sourceMaps?.permissions.canManageToken"
                      icon="i-lucide-key"
                      color="neutral"
                      variant="outline"
                      label="Create upload token"
                      :loading="tokenPending"
                      @click="manageToken"
                    />
                    <p
                      v-else
                      class="text-xs text-muted"
                    >
                      {{ tokenNotice }}
                    </p>
                  </div>
                  <p
                    v-if="sourceMaps?.token?.lastUsedAt"
                    class="mt-2 text-xs text-dimmed"
                  >
                    Last used {{ formatRelative(sourceMaps.token.lastUsedAt) }}
                  </p>
                </div>

                <div>
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-dimmed">
                    3 · Upload after each build
                  </p>
                  <div class="relative rounded-lg border border-default bg-muted p-4">
                    <pre class="overflow-x-auto font-mono text-xs leading-6 text-highlighted">{{ uploadCommand }}</pre>
                    <UButton
                      :icon="copied === 'upload' ? 'i-lucide-check' : 'i-lucide-copy'"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      class="absolute right-3 top-3"
                      aria-label="Copy upload command"
                      @click="copy(uploadCommand, 'upload')"
                    />
                  </div>
                  <p class="mt-2 text-xs leading-5 text-muted">
                    Set the same value as <code class="font-mono">release</code> in your SDK options to tie maps to the build that produced them. Without it Argus falls back to matching on file name, which still works for content-hashed bundles.
                  </p>
                </div>

                <div v-if="sourceMaps?.releases.length">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-dimmed">
                    Uploaded
                  </p>
                  <div class="divide-y divide-default/60 rounded-lg border border-default">
                    <div
                      v-for="entry in sourceMaps.releases"
                      :key="entry.release || 'unreleased'"
                      class="flex flex-wrap items-center gap-2 px-3 py-2 text-xs"
                    >
                      <code class="font-mono text-highlighted">{{ entry.release || 'no release' }}</code>
                      <span class="text-dimmed">{{ entry.files }} files · {{ formatBytes(entry.size) }}</span>
                      <span class="ml-auto text-dimmed">{{ formatRelative(entry.uploadedAt) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </UCard>
          </div>

          <aside class="space-y-4">
            <UCard>
              <template #header>
                <h3 class="text-sm font-semibold">
                  Project DSN
                </h3>
              </template>
              <p class="break-all font-mono text-xs text-muted">
                {{ dsn }}
              </p>
              <UButton
                class="mt-4"
                block
                color="neutral"
                variant="outline"
                :icon="copied === 'dsn' ? 'i-lucide-check' : 'i-lucide-copy'"
                label="Copy DSN"
                @click="copy(dsn, 'dsn')"
              />
            </UCard>
            <UCard>
              <template #header>
                <h3 class="text-sm font-semibold">
                  Verify ingestion
                </h3>
              </template>
              <p class="text-xs leading-5 text-muted">
                Send a safe sample event and confirm the issue viewer works.
              </p>
              <UButton
                class="mt-4"
                block
                :loading="sending"
                :icon="sent ? 'i-lucide-check' : 'i-lucide-send'"
                :label="sent ? 'Test event sent' : 'Send test event'"
                :color="sent ? 'success' : 'primary'"
                @click="sendTestEvent"
              />
              <UButton
                v-if="sent"
                class="mt-2"
                block
                color="neutral"
                variant="ghost"
                label="Open issue list"
                :to="`/projects/${route.params.id}`"
              />
            </UCard>
          </aside>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
