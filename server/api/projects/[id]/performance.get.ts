import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '../../../db'
import { performanceTransaction, project } from '../../../db/schema'
import { requireOrganizationMember } from '../../../lib/access'
import { TRANSACTION_LIMIT_PER_PROJECT } from '../../../lib/ingest-performance'

const endpointLimit = 100

const ranges = {
  '24h': { hours: 24, points: 24, bucketSeconds: 3_600 },
  '7d': { hours: 24 * 7, points: 28, bucketSeconds: 21_600 },
  '30d': { hours: 24 * 30, points: 30, bucketSeconds: 86_400 }
} as const

function seriesFrom(
  rows: Array<{ ago: number, requests: number, average_ms: number, p95_ms: number }>,
  points: number,
  bucketSeconds: number
) {
  const now = Date.now()
  // Buckets are counted backwards from now, so index 0 is the oldest one in the range.
  const result = Array.from({ length: points }, (_, index) => ({
    at: new Date(now - (points - 1 - index) * bucketSeconds * 1000).toISOString(),
    requests: 0,
    averageMs: 0,
    p95Ms: 0
  }))
  for (const row of rows) {
    const point = result[points - 1 - Number(row.ago)]
    if (!point) continue
    point.requests = Number(row.requests)
    point.averageMs = Math.round(Number(row.average_ms) * 10) / 10
    point.p95Ms = Math.round(Number(row.p95_ms) * 10) / 10
  }
  return result
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const selected = await db.query.project.findFirst({ where: eq(project.id, id) })
  if (!selected) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  const { membership } = await requireOrganizationMember(event, selected.organizationId)
  const canDelete = membership.role.split(',').some(role => ['owner', 'admin'].includes(role))

  const query = getQuery(event)
  const requestedRange = String(query.range || '7d')
  const rangeKey = requestedRange in ranges ? requestedRange as keyof typeof ranges : '7d'
  const range = ranges[rangeKey]
  const endpoint = String(query.endpoint || '').trim()
  const since = new Date(Date.now() - range.hours * 3_600_000)
  const inRange = and(
    eq(performanceTransaction.projectId, id),
    gte(performanceTransaction.startTimestamp, since)
  )
  // Drilling into an endpoint scopes the summary, the chart series and the request list to it.
  // The endpoint table itself stays project wide so it can still be used to switch endpoints.
  const scoped = endpoint ? and(inRange, eq(performanceTransaction.name, endpoint)) : inRange
  const scopedName = endpoint ? sql`and ${performanceTransaction.name} = ${endpoint}` : sql``

  const [summaryRows, endpointRows, recent, seriesRows, [stored]] = await Promise.all([
    db.select({
      requests: sql<number>`count(*)::int`,
      averageMs: sql<number>`coalesce(avg(${performanceTransaction.durationMs}), 0)::float8`,
      p95Ms: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${performanceTransaction.durationMs}), 0)::float8`,
      failureRate: sql<number>`coalesce(100.0 * count(*) filter (
        where ${performanceTransaction.status} in ('internal_error', 'unknown_error', 'deadline_exceeded', 'unavailable')
           or ${performanceTransaction.statusCode} >= 500
      ) / nullif(count(*), 0), 0)::float8`
    }).from(performanceTransaction).where(scoped),

    db.select({
      name: performanceTransaction.name,
      method: sql<string | null>`max(${performanceTransaction.method})`,
      requests: sql<number>`count(*)::int`,
      averageMs: sql<number>`avg(${performanceTransaction.durationMs})::float8`,
      p95Ms: sql<number>`percentile_cont(0.95) within group (order by ${performanceTransaction.durationMs})::float8`,
      maxMs: sql<number>`max(${performanceTransaction.durationMs})::float8`,
      failures: sql<number>`count(*) filter (
        where ${performanceTransaction.status} in ('internal_error', 'unknown_error', 'deadline_exceeded', 'unavailable')
           or ${performanceTransaction.statusCode} >= 500
      )::int`,
      lastSeen: sql<Date>`max(${performanceTransaction.startTimestamp})`
    }).from(performanceTransaction)
      .where(inRange)
      .groupBy(performanceTransaction.name)
      .orderBy(sql`count(*) desc`)
      .limit(endpointLimit + 1),

    db.select({
      id: performanceTransaction.id,
      eventId: performanceTransaction.eventId,
      name: performanceTransaction.name,
      method: performanceTransaction.method,
      durationMs: performanceTransaction.durationMs,
      status: performanceTransaction.status,
      statusCode: performanceTransaction.statusCode,
      environment: performanceTransaction.environment,
      startTimestamp: performanceTransaction.startTimestamp
    }).from(performanceTransaction)
      .where(scoped)
      .orderBy(desc(performanceTransaction.startTimestamp))
      .limit(100),

    db.execute<{ ago: number, requests: number, average_ms: number, p95_ms: number }>(sql`
      select floor(extract(epoch from (now() - ${performanceTransaction.startTimestamp})) / ${range.bucketSeconds})::int as ago,
             count(*)::int as requests,
             avg(${performanceTransaction.durationMs})::float8 as average_ms,
             percentile_cont(0.95) within group (order by ${performanceTransaction.durationMs})::float8 as p95_ms
      from ${performanceTransaction}
      where ${performanceTransaction.projectId} = ${id}
        and ${performanceTransaction.startTimestamp} >= ${since}
        ${scopedName}
      group by 1
      order by 1 desc
    `),

    db.select({ count: sql<number>`count(*)::int` })
      .from(performanceTransaction)
      .where(eq(performanceTransaction.projectId, id))
  ])

  const summary = summaryRows[0] || { requests: 0, averageMs: 0, p95Ms: 0, failureRate: 0 }
  return {
    project: selected,
    permissions: { canDelete },
    range: rangeKey,
    endpoint: endpoint || null,
    retention: { stored: stored?.count || 0, limit: TRANSACTION_LIMIT_PER_PROJECT },
    stats: {
      requests: Number(summary.requests),
      averageMs: Number(summary.averageMs),
      p95Ms: Number(summary.p95Ms),
      failureRate: Number(summary.failureRate)
    },
    series: seriesFrom(seriesRows.rows, range.points, range.bucketSeconds),
    endpointsTruncated: endpointRows.length > endpointLimit,
    endpoints: endpointRows.slice(0, endpointLimit).map(row => ({
      ...row,
      requests: Number(row.requests),
      averageMs: Number(row.averageMs),
      p95Ms: Number(row.p95Ms),
      maxMs: Number(row.maxMs),
      failures: Number(row.failures)
    })),
    transactions: recent.map(row => ({ ...row, durationMs: Number(row.durationMs) }))
  }
})
