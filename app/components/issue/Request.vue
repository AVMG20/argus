<script setup lang="ts">
import type { UnknownRecord } from '~/utils/sentry'

const props = defineProps<{
  request: UnknownRecord
  contexts?: UnknownRecord
}>()

const knownKeys = ['url', 'method', 'headers', 'cookies', 'cookie', 'query_string', 'queryString', 'data', 'env', 'body_size', 'fragment', 'protocol']

const method = computed(() => String(props.request.method || 'GET').toUpperCase())
const url = computed(() => String(props.request.url || ''))
const response = computed(() => (isRecord(props.contexts?.response) ? props.contexts.response : {}) as UnknownRecord)
const statusCode = computed(() => Number(response.value.status_code ?? response.value.statusCode ?? 0))

const headers = computed(() => normalizePairs(props.request.headers))
const cookies = computed(() => normalizeCookies(props.request.cookies ?? props.request.cookie))
const env = computed(() => normalizePairs(props.request.env))
const body = computed(() => props.request.data)
const other = computed(() => Object.entries(props.request).filter(([key]) => !knownKeys.includes(key)))

const userAgent = computed(() => headers.value.find(([key]) => key.toLowerCase() === 'user-agent')?.[1])
const referer = computed(() => headers.value.find(([key]) => key.toLowerCase() === 'referer' || key.toLowerCase() === 'referrer')?.[1])

const queryParams = computed<Array<[string, unknown]>>(() => {
  const raw = props.request.query_string ?? props.request.queryString
  if (typeof raw === 'string' && raw) return [...new URLSearchParams(raw.replace(/^\?/, ''))]
  if (raw) return normalizePairs(raw)
  const search = url.value.includes('?') ? url.value.slice(url.value.indexOf('?') + 1) : ''
  return search ? [...new URLSearchParams(search)] : []
})

const path = computed(() => {
  if (!url.value) return ''
  try {
    const parsed = new URL(url.value)
    return `${parsed.pathname}${parsed.hash}`
  } catch {
    return url.value
  }
})

const origin = computed(() => {
  try {
    return new URL(url.value).origin
  } catch {
    return ''
  }
})

function normalizePairs(value: unknown): Array<[string, unknown]> {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(item => Array.isArray(item) && item.length >= 2) as Array<[string, unknown]>
  if (typeof value === 'object') return Object.entries(value as UnknownRecord)
  return [['value', value]]
}

function normalizeCookies(value: unknown): Array<[string, unknown]> {
  if (typeof value === 'string') {
    return value.split(';').filter(Boolean).map((part) => {
      const [name, ...rest] = part.trim().split('=')
      return [name || 'cookie', rest.join('=') || '[Filtered]'] as [string, unknown]
    })
  }
  return normalizePairs(value)
}

function statusTone(code: number) {
  if (code >= 500) return 'text-error'
  if (code >= 400) return 'text-warning'
  if (code >= 200) return 'text-success'
  return 'text-muted'
}
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="!Object.keys(request).length"
      class="rounded-lg border border-default bg-elevated/20 px-3 py-8 text-center text-xs text-dimmed"
    >
      No request captured. The SDK adds this when it can read the incoming request or the page location.
    </p>

    <template v-else>
      <div class="rounded-lg border border-default bg-elevated/20 p-3">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <span class="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{{ method }}</span>
          <code class="min-w-0 flex-1 break-all text-sm text-highlighted">{{ path || 'URL not provided' }}</code>
          <span
            v-if="statusCode"
            class="font-mono text-xs font-semibold"
            :class="statusTone(statusCode)"
          >{{ statusCode }}</span>
          <CopyButton
            v-if="url"
            :value="url"
          />
          <UButton
            v-if="url.startsWith('http')"
            :to="url"
            target="_blank"
            icon="i-lucide-external-link"
            size="xs"
            color="neutral"
            variant="ghost"
            aria-label="Open URL"
          />
        </div>
        <p
          v-if="origin"
          class="mt-1 truncate font-mono text-[11px] text-dimmed"
        >
          {{ origin }}
        </p>
        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-default/60 pt-2 text-[11px] text-dimmed">
          <span
            v-if="referer"
            class="min-w-0 truncate"
          >referer <span class="font-mono text-muted">{{ referer }}</span></span>
          <span
            v-if="userAgent"
            class="min-w-0 truncate"
            :title="String(userAgent)"
          >agent <span class="font-mono text-muted">{{ inlineValue(userAgent, 70) }}</span></span>
        </div>
      </div>

      <div class="grid gap-3 xl:grid-cols-2">
        <AppPanel
          title="Headers"
          icon="i-lucide-list"
          :count="headers.length"
        >
          <DataList
            :entries="headers"
            searchable
            key-width="10rem"
            empty="No headers captured."
          />
        </AppPanel>

        <AppPanel
          title="Cookies"
          icon="i-lucide-cookie"
          :count="cookies.length"
          hint="values filtered on ingest"
        >
          <DataList
            :entries="cookies"
            searchable
            key-width="10rem"
            empty="No cookies captured."
          />
        </AppPanel>

        <AppPanel
          v-if="queryParams.length"
          title="Query parameters"
          icon="i-lucide-search"
          :count="queryParams.length"
        >
          <DataList
            :entries="queryParams"
            key-width="10rem"
          />
        </AppPanel>

        <AppPanel
          v-if="body !== undefined && body !== null && body !== ''"
          title="Body"
          icon="i-lucide-file-json"
        >
          <DataList
            v-if="isRecord(body)"
            :data="body"
            key-width="10rem"
          />
          <pre
            v-else
            class="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-highlighted"
          >{{ displayValue(body) }}</pre>
        </AppPanel>

        <AppPanel
          v-if="env.length"
          title="Environment"
          icon="i-lucide-server"
          :count="env.length"
        >
          <DataList
            :entries="env"
            searchable
            key-width="10rem"
          />
        </AppPanel>

        <AppPanel
          v-if="other.length"
          title="Other request data"
          icon="i-lucide-braces"
          :count="other.length"
        >
          <DataList
            :entries="other"
            key-width="10rem"
          />
        </AppPanel>
      </div>
    </template>
  </div>
</template>
