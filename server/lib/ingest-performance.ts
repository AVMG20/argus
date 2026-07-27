import { sql } from 'drizzle-orm'
import { db } from '../db'
import { performanceSpan, performanceTransaction, type project } from '../db/schema'
import { sanitizeValue, type EventPayload } from './ingest'

const TRANSACTION_LIMIT_PER_PROJECT = 100_000
const MAX_SPANS_PER_TRANSACTION = 250

type SpanPayload = {
  span_id?: string
  trace_id?: string
  parent_span_id?: string
  op?: string
  description?: string
  start_timestamp?: string | number
  timestamp?: string | number
  status?: string
  data?: Record<string, unknown>
  tags?: Record<string, string>
}

export type TransactionPayload = EventPayload & {
  type?: string
  start_timestamp?: string | number
  spans?: SpanPayload[]
  measurements?: Record<string, unknown>
}

function eventDate(value: unknown, fallback = new Date()) {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback
  const date = new Date(typeof value === 'number' && value < 10_000_000_000 ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? fallback : date
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function numericValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
}

function durationMs(start: Date, end: Date) {
  return Math.max(0, end.getTime() - start.getTime())
}

export async function ingestTransaction(
  selectedProject: typeof project.$inferSelect,
  body: TransactionPayload
) {
  const payload = sanitizeValue(body) as TransactionPayload
  const trace = record(payload.contexts?.trace)
  const request = record(payload.request)
  const response = record(payload.contexts?.response)
  const tags = Array.isArray(payload.tags) ? Object.fromEntries(payload.tags) : payload.tags
  const end = eventDate(payload.timestamp)
  const start = eventDate(payload.start_timestamp, end)
  const eventId = payload.eventId || payload.event_id || crypto.randomUUID().replaceAll('-', '')
  const transactionId = crypto.randomUUID()
  const statusCode = numericValue(response.status_code)
    ?? numericValue(tags?.['http.status_code'])
    ?? numericValue(request.status_code)
  const transactionStatus = textValue(trace.status)
  const method = textValue(request.method) ?? textValue(tags?.['http.method'])

  const [inserted] = await db.insert(performanceTransaction).values({
    id: transactionId,
    eventId,
    projectId: selectedProject.id,
    name: payload.transaction || textValue(request.url) || 'Unnamed transaction',
    operation: textValue(trace.op),
    traceId: textValue(trace.trace_id),
    spanId: textValue(trace.span_id),
    parentSpanId: textValue(trace.parent_span_id),
    startTimestamp: start,
    endTimestamp: end,
    durationMs: durationMs(start, end),
    status: transactionStatus,
    method,
    statusCode: statusCode == null ? undefined : Math.round(statusCode),
    environment: payload.environment || 'production',
    release: payload.release,
    user: payload.user,
    request: payload.request,
    tags,
    contexts: payload.contexts,
    measurements: payload.measurements,
    rawPayload: payload
  }).onConflictDoNothing({ target: performanceTransaction.eventId }).returning({ id: performanceTransaction.id })

  if (!inserted) return { id: eventId }

  const spans = (payload.spans || []).slice(0, MAX_SPANS_PER_TRANSACTION).map((span) => {
    const spanEnd = eventDate(span.timestamp, end)
    const spanStart = eventDate(span.start_timestamp, spanEnd)
    return {
      id: crypto.randomUUID(),
      transactionId,
      spanId: span.span_id || crypto.randomUUID().replaceAll('-', '').slice(0, 16),
      traceId: span.trace_id,
      parentSpanId: span.parent_span_id,
      operation: span.op,
      description: span.description,
      startTimestamp: spanStart,
      endTimestamp: spanEnd,
      durationMs: durationMs(spanStart, spanEnd),
      status: span.status,
      data: sanitizeValue(span.data) as Record<string, unknown> | undefined,
      tags: sanitizeValue(span.tags) as Record<string, string> | undefined
    }
  })
  if (spans.length) await db.insert(performanceSpan).values(spans).onConflictDoNothing()

  // Keep storage bounded per project. Child spans are removed by the FK cascade.
  await db.execute(sql`
    delete from ${performanceTransaction}
    where ${performanceTransaction.id} in (
      select ${performanceTransaction.id}
      from ${performanceTransaction}
      where ${performanceTransaction.projectId} = ${selectedProject.id}
      order by ${performanceTransaction.startTimestamp} desc, ${performanceTransaction.id} desc
      offset ${TRANSACTION_LIMIT_PER_PROJECT}
    )
  `)

  return { id: eventId }
}
