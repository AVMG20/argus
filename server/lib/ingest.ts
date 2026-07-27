import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import { errorEvent, issue, type project } from '../db/schema'

export type Frame = {
  [key: string]: unknown
  filename?: string
  function?: string
  lineno?: number
  colno?: number
  inApp?: boolean
  in_app?: boolean
  contextLine?: string
  context_line?: string
  preContext?: string[]
  pre_context?: string[]
  postContext?: string[]
  post_context?: string[]
}

type ExceptionValue = {
  [key: string]: unknown
  type?: string
  value?: string
  stacktrace?: { frames?: Frame[] } | Frame[]
}

export type EventPayload = {
  [key: string]: unknown
  eventId?: string
  event_id?: string
  timestamp?: string | number
  message?: string | { formatted?: string }
  exception?: ExceptionValue[] | (ExceptionValue & { values?: ExceptionValue[] })
  level?: string
  environment?: string
  release?: string
  serverName?: string
  server_name?: string
  transaction?: string
  fingerprint?: string[]
  tags?: Record<string, string> | Array<[string, string]>
  contexts?: Record<string, unknown>
  request?: Record<string, unknown>
  user?: Record<string, unknown>
  breadcrumbs?: Array<Record<string, unknown>> | { values?: Array<Record<string, unknown>> }
}

function hash(value: string) {
  let result = 2166136261
  for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 16777619)
  return (result >>> 0).toString(16)
}

function framesFrom(exception?: ExceptionValue) {
  if (!exception?.stacktrace) return []
  return Array.isArray(exception.stacktrace) ? exception.stacktrace : exception.stacktrace.frames || []
}

function normalizeFrame(frame: Frame) {
  return {
    ...frame,
    filename: frame.filename,
    function: frame.function,
    lineno: frame.lineno,
    colno: frame.colno,
    inApp: frame.inApp ?? frame.in_app ?? false,
    contextLine: frame.contextLine ?? frame.context_line,
    preContext: frame.preContext ?? frame.pre_context,
    postContext: frame.postContext ?? frame.post_context
  }
}

function exceptionValues(value: EventPayload['exception']) {
  if (!value) return []
  if (Array.isArray(value)) return value
  return value.values?.length ? value.values : [value]
}

function redactCookieString(value: string) {
  return value
    .split(';')
    .map((cookie) => {
      const [name] = cookie.trim().split('=')
      return name ? `${name}=[Filtered]` : '[Filtered]'
    })
    .join('; ')
}

export function sanitizeValue(value: unknown, key = ''): unknown {
  const normalizedKey = key.toLowerCase()
  const isCookie = normalizedKey === 'cookie' || normalizedKey === 'cookies' || normalizedKey === 'set-cookie'
  const isSensitive = /(authorization|auth_token|access_token|refresh_token|password|passwd|secret|api[-_]?key|session)/i.test(key)

  if (isCookie) {
    if (typeof value === 'string') return redactCookieString(value)
    if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? redactCookieString(item) : '[Filtered]')
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).map(cookieName => [cookieName, '[Filtered]']))
    }
    return '[Filtered]'
  }
  if (isSensitive) return '[Filtered]'
  if (Array.isArray(value)) return value.map(item => sanitizeValue(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitizeValue(childValue, childKey)]))
  }
  return value
}

export async function ingestEvent(selectedProject: typeof project.$inferSelect, body: EventPayload) {
  const sanitizedBody = sanitizeValue(body) as EventPayload
  const exceptionChain = exceptionValues(sanitizedBody.exception)
  const exception = exceptionChain.at(-1)
  const frames = framesFrom(exception).map(normalizeFrame)
  const normalizedExceptions = exceptionChain.map(item => ({
    ...item,
    stacktrace: {
      ...(!Array.isArray(item.stacktrace) && item.stacktrace ? item.stacktrace : {}),
      frames: framesFrom(item).map(normalizeFrame)
    }
  }))
  const rawMessage = typeof sanitizedBody.message === 'string' ? sanitizedBody.message : sanitizedBody.message?.formatted
  const title = exception?.value || rawMessage || 'Unknown error'
  const type = exception?.type || 'Error'
  const topFrame = frames.find(frame => frame.inApp) || frames.at(-1) || frames[0]
  const fingerprint = sanitizedBody.fingerprint?.join(':') || hash(`${type}:${title}:${topFrame?.filename || ''}:${topFrame?.function || ''}`)
  const timestamp = sanitizedBody.timestamp ? new Date(typeof sanitizedBody.timestamp === 'number' && sanitizedBody.timestamp < 10_000_000_000 ? sanitizedBody.timestamp * 1000 : sanitizedBody.timestamp) : new Date()
  const now = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp

  let selectedIssue = await db.query.issue.findFirst({
    where: sql`${issue.projectId} = ${selectedProject.id} and ${issue.fingerprint} = ${fingerprint}`
  })

  if (selectedIssue) {
    const [updated] = await db.update(issue).set({
      eventCount: sql`${issue.eventCount} + 1`,
      lastSeen: now,
      status: 'unresolved'
    }).where(eq(issue.id, selectedIssue.id)).returning()
    selectedIssue = updated
  } else {
    const [created] = await db.insert(issue).values({
      id: crypto.randomUUID(),
      projectId: selectedProject.id,
      fingerprint,
      title: `${type}: ${title}`,
      culprit: [topFrame?.filename, topFrame?.function].filter(Boolean).join(' in '),
      level: sanitizedBody.level || 'error',
      firstSeen: now,
      lastSeen: now
    }).returning()
    selectedIssue = created
  }

  if (!selectedIssue) throw createError({ statusCode: 500, statusMessage: 'Could not group the event' })
  const eventId = sanitizedBody.eventId || sanitizedBody.event_id || crypto.randomUUID().replaceAll('-', '')
  const tags = Array.isArray(sanitizedBody.tags) ? Object.fromEntries(sanitizedBody.tags) : sanitizedBody.tags
  const breadcrumbs = Array.isArray(sanitizedBody.breadcrumbs) ? sanitizedBody.breadcrumbs : sanitizedBody.breadcrumbs?.values

  await db.insert(errorEvent).values({
    id: crypto.randomUUID(),
    eventId,
    issueId: selectedIssue.id,
    timestamp: now,
    environment: sanitizedBody.environment || 'production',
    release: sanitizedBody.release,
    serverName: sanitizedBody.serverName || sanitizedBody.server_name,
    transaction: sanitizedBody.transaction,
    message: rawMessage,
    exceptionType: type,
    exceptionValue: title,
    stacktrace: frames,
    exceptions: normalizedExceptions,
    tags,
    contexts: sanitizedBody.contexts,
    request: sanitizedBody.request,
    user: sanitizedBody.user,
    breadcrumbs,
    rawPayload: sanitizedBody
  }).onConflictDoNothing({ target: errorEvent.eventId })

  return { id: eventId, issueId: selectedIssue.id }
}
