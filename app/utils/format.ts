const absoluteFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'medium' })
const clockFormatter = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

/** Sentry sends timestamps as ISO strings or epoch seconds; both land here. */
export function toDate(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const date = new Date(typeof value === 'number' && value < 10_000_000_000 ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function formatAbsolute(value: unknown) {
  const date = toDate(value)
  return date ? absoluteFormatter.format(date) : '—'
}

export function formatClock(value: unknown) {
  const date = toDate(value)
  return date ? clockFormatter.format(date) : '—'
}

/** Compact age used in dense tables: 5m, 2h, 3d. */
export function formatAge(value: unknown) {
  const date = toDate(value)
  if (!date) return '—'
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`
  if (seconds < 2_592_000) return `${Math.round(seconds / 86_400)}d`
  return `${Math.round(seconds / 2_592_000)}mo`
}

export function formatRelative(value: unknown) {
  const age = formatAge(value)
  return age === '—' ? age : `${age} ago`
}

/** Signed offset between a breadcrumb and the moment the error was captured. */
export function formatOffset(from: unknown, to: unknown) {
  const start = toDate(from)
  const end = toDate(to)
  if (!start || !end) return ''
  const ms = start.getTime() - end.getTime()
  if (Math.abs(ms) < 1000) return `${ms >= 0 ? '+' : '−'}${Math.abs(ms)}ms`
  const seconds = Math.abs(ms) / 1000
  const sign = ms >= 0 ? '+' : '−'
  if (seconds < 60) return `${sign}${seconds.toFixed(1)}s`
  if (seconds < 3600) return `${sign}${Math.round(seconds / 60)}m`
  return `${sign}${Math.round(seconds / 3600)}h`
}

export function formatCount(value: unknown) {
  const count = Number(value)
  if (!Number.isFinite(count)) return '0'
  if (Math.abs(count) < 1000) return String(count)
  if (Math.abs(count) < 1_000_000) return `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}k`
  return `${(count / 1_000_000).toFixed(1)}m`
}

export function formatDuration(value: unknown) {
  const ms = Number(value)
  if (!Number.isFinite(ms)) return String(value ?? '—')
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`
  return `${Math.round(ms / 1000 / 60)}m`
}

export function displayValue(value: unknown) {
  if (value === null) return 'null'
  if (value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

/** Single-line rendering for values shown inside dense rows. */
export function inlineValue(value: unknown, limit = 120) {
  const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : displayValue(value)
  const flattened = text.replace(/\s+/g, ' ').trim()
  return flattened.length > limit ? `${flattened.slice(0, limit - 1)}…` : flattened
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function recordEntries(value: unknown): Array<[string, unknown]> {
  return isRecord(value) ? Object.entries(value) : []
}

export function hasValues(value: unknown) {
  return recordEntries(value).length > 0
}

export function humanizeKey(key: string) {
  return key.replaceAll('_', ' ').replaceAll('-', ' ')
}

/** Trims noisy bundler prefixes so a frame reads as a source path. */
export function shortPath(value: unknown) {
  if (typeof value !== 'string' || !value) return ''
  const withoutQuery = value.split('?')[0] || value
  return withoutQuery
    .replaceAll('\\', '/')
    .replace(/^webpack-internal:\/{3}/, '')
    // Covers http://host/, app:/// and webpack://name/ alike.
    .replace(/^[a-z]+:\/\/[^/]*\//i, '')
    .replace(/^(\.\/|\/)?(_nuxt|_next|static|dist|build)\//, '')
    .replace(/^@fs\//, '')
    // Vite pre-bundles dependencies into an opaque cache directory; name it for what it is.
    .replace(/^.*node_modules\/\.(?:cache\/)?vite\/(?:[^/]+\/)*deps\//, 'vite-deps/')
    // Everything else under node_modules reads better starting at the package name.
    .replace(/^.*node_modules\//, '')
    .replace(/^\/?(?:Users|home)\/[^/]+\//, '~/')
    .replace(/^[a-z]:\/Users\/[^/]+\//i, '~/')
    .replace(/^\.\//, '')
}

export function fileName(value: unknown) {
  const path = shortPath(value)
  return path.split('/').at(-1) || path
}
