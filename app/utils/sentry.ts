export type UnknownRecord = Record<string, unknown>

/** What a frame pointed at before Argus resolved it through an uploaded source map. */
export type MinifiedOrigin = {
  release?: string | null
  artifact?: string
  filename?: string | null
  lineno?: number | null
  colno?: number | null
  function?: string | null
}

export type FrameRecord = UnknownRecord & {
  sourcemap?: MinifiedOrigin
  filename?: string
  abs_path?: string
  module?: string
  package?: string
  function?: string
  raw_function?: string
  lineno?: number
  colno?: number
  inApp?: boolean
  in_app?: boolean
  platform?: string
  instruction_addr?: string
  contextLine?: string
  context_line?: string
  preContext?: string[]
  pre_context?: string[]
  postContext?: string[]
  post_context?: string[]
  vars?: UnknownRecord
}

export type Mechanism = UnknownRecord & {
  type?: string
  handled?: boolean
  synthetic?: boolean
  source?: string
  description?: string
  help_link?: string
  parent_id?: number
  exception_id?: number
  data?: UnknownRecord
}

export type ExceptionRecord = UnknownRecord & {
  type?: string
  value?: string
  module?: string
  mechanism?: Mechanism
  stacktrace?: FrameRecord[] | { frames?: FrameRecord[] }
}

export type StoredEvent = UnknownRecord & {
  id: string
  issueId: string
  eventId: string
  timestamp: string
  environment: string
  release?: string | null
  serverName?: string | null
  transaction?: string | null
  message?: string | null
  exceptionType?: string | null
  exceptionValue?: string | null
  stacktrace?: FrameRecord[] | null
  exceptions?: ExceptionRecord[] | null
  tags?: UnknownRecord | null
  contexts?: UnknownRecord | null
  request?: UnknownRecord | null
  user?: UnknownRecord | null
  breadcrumbs?: UnknownRecord[] | null
  rawPayload?: UnknownRecord | null
}

export type SourceLine = { number: number, code: string, active: boolean }

export function isInApp(frame: FrameRecord) {
  return Boolean(frame.inApp ?? frame.in_app)
}

const VENDOR_MARKERS = ['/node_modules/', '/.cache/vite/', '/.vite/deps/', '/bower_components/', '/.nuxt/dist/', '/.next/static/']
const VENDOR_PREFIXES = ['node:', 'internal/', 'webpack-internal:', 'chrome-extension:', 'moz-extension:', 'safari-web-extension:', 'vite-deps/', '@sentry/']

/** Dependency and runtime code, which is never the frame a reader is looking for. */
export function isVendorFrame(frame: FrameRecord) {
  const raw = String(frame.filename || frame.abs_path || frame.module || frame.package || '').replaceAll('\\', '/')
  if (!raw) return false
  if (VENDOR_MARKERS.some(marker => `/${raw}`.includes(marker))) return true
  const cleaned = shortPath(raw) || raw
  return VENDOR_PREFIXES.some(prefix => raw.startsWith(prefix) || cleaned.startsWith(prefix))
}

/**
 * Relevance score, highest wins. The SDK's in_app flag counts for more than the path,
 * but dev bundlers flag every frame as app code, so a non-vendor path breaks the tie.
 */
export function frameRank(frame: FrameRecord) {
  return (isInApp(frame) ? 2 : 0) + (isVendorFrame(frame) ? 0 : 1)
}

/** Frames arrive oldest-call-first; the UI reads better with the throwing frame on top. */
export function framesFor(exception: ExceptionRecord | undefined) {
  if (!exception?.stacktrace) return []
  const stacktrace = exception.stacktrace
  const frames = Array.isArray(stacktrace) ? stacktrace : stacktrace.frames
  return [...(frames || [])].reverse()
}

export function frameFunction(frame: FrameRecord) {
  const name = frame.function || frame.raw_function
  return !name || name === '?' ? '<anonymous>' : name
}

export type FrameLocation = { dir: string, file: string, position: string, full: string }

/**
 * Splits a frame's location so the directory can be dimmed and the file name — the part
 * a reader actually scans for — kept legible however long the prefix is.
 */
export function frameLocationParts(frame: FrameRecord): FrameLocation {
  const path = shortPath(frame.filename || frame.abs_path) || String(frame.module || frame.package || '') || 'unknown source'
  const cut = path.lastIndexOf('/')
  const position = [frame.lineno, frame.colno].filter(value => value !== undefined && value !== null).join(':')
  return {
    dir: cut >= 0 ? path.slice(0, cut + 1) : '',
    file: cut >= 0 ? path.slice(cut + 1) : path,
    position: position ? `:${position}` : '',
    full: String(frame.abs_path || frame.filename || path)
  }
}

export function frameLocation(frame: FrameRecord) {
  const { dir, file, position } = frameLocationParts(frame)
  return `${dir}${file}${position}`
}

export function sourceLines(frame: FrameRecord): SourceLine[] {
  const pre = frame.preContext || frame.pre_context || []
  const post = frame.postContext || frame.post_context || []
  const context = frame.contextLine ?? frame.context_line
  const line = Number(frame.lineno || 0)
  return [
    ...pre.map((code, index) => ({ number: line - pre.length + index, code, active: false })),
    ...(context !== undefined ? [{ number: line, code: context, active: true }] : []),
    ...post.map((code, index) => ({ number: line + index + 1, code, active: false }))
  ]
}

export function frameMetadata(frame: FrameRecord): Array<[string, unknown]> {
  return (['module', 'package', 'abs_path', 'platform', 'instruction_addr', 'symbol', 'symbol_addr', 'image_addr', 'addr_mode', 'source_link'] as const)
    .filter(key => frame[key] !== undefined && frame[key] !== null && frame[key] !== '')
    .map(key => [key, frame[key]])
}

export function frameHasDetails(frame: FrameRecord) {
  return sourceLines(frame).length > 0 || hasValues(frame.vars) || frameMetadata(frame).length > 0 || isSourceMapped(frame)
}

/** True once Argus has mapped this frame back through an uploaded source map. */
export function isSourceMapped(frame: FrameRecord) {
  return Boolean(frame.sourcemap)
}

/** The bundled file and position the frame was reported as, for reference on a resolved frame. */
export function minifiedOrigin(frame: FrameRecord) {
  const origin = frame.sourcemap
  if (!origin) return ''
  const file = String(origin.filename || '').split('/').pop() || 'bundle'
  const position = [origin.lineno, origin.colno].filter(value => value !== undefined && value !== null).join(':')
  return position ? `${file}:${position}` : file
}

/**
 * A frame is "minified" when it has a position but no source to show. A resolved frame is
 * never minified, even when the map shipped without sourcesContent and left no snippet.
 */
export function looksMinified(frame: FrameRecord) {
  if (isSourceMapped(frame)) return false
  const hasPosition = Boolean(frame.lineno)
  const hasSource = sourceLines(frame).length > 0
  const name = frame.function || frame.raw_function
  return hasPosition && !hasSource && (!name || name === '?' || /^[a-z$_]{1,3}$/i.test(name))
}

export function exceptionChain(selectedEvent: StoredEvent | undefined): ExceptionRecord[] {
  if (!selectedEvent) return []
  if (selectedEvent.exceptions?.length) return [...selectedEvent.exceptions].reverse()
  return [{
    type: selectedEvent.exceptionType || undefined,
    value: selectedEvent.exceptionValue || undefined,
    stacktrace: { frames: selectedEvent.stacktrace || [] }
  }]
}

export function isUnhandled(exceptions: ExceptionRecord[]) {
  return exceptions.some(exception => exception.mechanism?.handled === false)
}

export function stackTraceText(exceptions: ExceptionRecord[]) {
  return exceptions.map((exception, index) => {
    const header = `${index ? 'Caused by: ' : ''}${exception.type || 'Error'}: ${exception.value || ''}`.trim()
    const frames = framesFor(exception).map(frame => `    at ${frameFunction(frame)} (${frameLocation(frame)})`)
    return [header, ...frames].join('\n')
  }).join('\n')
}

export function affectedUserLabel(user: unknown) {
  if (!isRecord(user)) return ''
  return String(user.username || user.email || user.id || user.ip_address || '')
}

export function levelTone(level: unknown) {
  const value = String(level || 'error')
  if (value === 'fatal') return 'error'
  if (value === 'warning') return 'warning'
  if (value === 'info' || value === 'debug' || value === 'log') return 'info'
  return 'error'
}

export function levelIcon(level: unknown) {
  const value = String(level || 'error')
  if (value === 'fatal') return 'i-lucide-skull'
  if (value === 'warning') return 'i-lucide-triangle-alert'
  if (value === 'info' || value === 'log') return 'i-lucide-info'
  if (value === 'debug') return 'i-lucide-bug'
  return 'i-lucide-circle-x'
}

export function breadcrumbIcon(crumb: UnknownRecord) {
  const category = String(crumb.category || crumb.type || '')
  if (category.startsWith('navigation') || category === 'route') return 'i-lucide-corner-down-right'
  if (['http', 'fetch', 'xhr'].includes(category) || category.startsWith('http')) return 'i-lucide-arrow-left-right'
  if (category.startsWith('ui.') || crumb.type === 'user') return 'i-lucide-mouse-pointer-click'
  if (category === 'console' || category.startsWith('log')) return 'i-lucide-terminal'
  if (category.startsWith('sentry')) return 'i-lucide-circle-x'
  if (category.startsWith('query') || category.startsWith('db')) return 'i-lucide-database'
  if (crumb.level === 'error' || crumb.type === 'error') return 'i-lucide-circle-alert'
  return 'i-lucide-dot'
}

export function breadcrumbLabel(crumb: UnknownRecord) {
  const message = crumb.message ?? (isRecord(crumb.data) ? crumb.data.url ?? crumb.data.to : undefined)
  return String(message || crumb.category || crumb.type || 'breadcrumb')
}

export function contextIcon(key: string) {
  return {
    browser: 'i-lucide-globe',
    device: 'i-lucide-smartphone',
    os: 'i-lucide-monitor',
    runtime: 'i-lucide-cpu',
    trace: 'i-lucide-git-branch',
    app: 'i-lucide-app-window',
    gpu: 'i-lucide-gpu',
    response: 'i-lucide-arrow-down-to-line',
    culture: 'i-lucide-languages',
    state: 'i-lucide-layers',
    profile: 'i-lucide-gauge',
    cloud_resource: 'i-lucide-cloud'
  }[key] || 'i-lucide-braces'
}
