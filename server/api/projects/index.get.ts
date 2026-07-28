import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { db } from '../../db'
import { errorEvent, issue, performanceTransaction, project } from '../../db/schema'
import { requireOrganizationMember } from '../../lib/access'
import { organizationProjectSeries } from '../../lib/analytics'

export default defineEventHandler(async (event) => {
  const organizationId = getQuery(event).organizationId?.toString()
  if (!organizationId) throw createError({ statusCode: 400, statusMessage: 'organizationId is required' })
  const { membership } = await requireOrganizationMember(event, organizationId)
  const canManage = membership.role.split(',').some(role => ['owner', 'admin'].includes(role))

  const rows = await db.select({
    id: project.id,
    name: project.name,
    slug: project.slug,
    platform: project.platform,
    publicKey: project.publicKey,
    createdAt: project.createdAt,
    issueCount: sql<number>`count(${issue.id})::int`,
    unresolvedCount: sql<number>`count(${issue.id}) filter (where ${issue.status} = 'unresolved')::int`,
    new7d: sql<number>`count(${issue.id}) filter (where ${issue.firstSeen} >= now() - interval '7 days')::int`,
    totalEvents: sql<number>`coalesce(sum(${issue.eventCount}), 0)::int`,
    lastSeen: sql<Date | null>`max(${issue.lastSeen})`
  })
    .from(project)
    .leftJoin(issue, eq(issue.projectId, project.id))
    .where(eq(project.organizationId, organizationId))
    .groupBy(project.id)
    .orderBy(desc(project.createdAt))

  const ids = rows.map(row => row.id)
  if (!ids.length) return []

  // The card is a seven-day view, so both aggregates stay inside that window and
  // never scan a project's full event or transaction history.
  const since = sql`now() - interval '7 days'`

  const [eventRows, performanceRows, seriesByProject] = await Promise.all([
    db.select({
      projectId: issue.projectId,
      events7d: sql<number>`count(*)::int`,
      users7d: sql<number>`count(distinct coalesce(${errorEvent.user}->>'id', ${errorEvent.user}->>'email', ${errorEvent.user}->>'username'))::int`
    })
      .from(errorEvent)
      .innerJoin(issue, eq(issue.id, errorEvent.issueId))
      .where(and(inArray(issue.projectId, ids), gte(errorEvent.timestamp, since)))
      .groupBy(issue.projectId),

    db.select({
      projectId: performanceTransaction.projectId,
      requests7d: sql<number>`count(*)::int`,
      averageMs: sql<number>`coalesce(avg(${performanceTransaction.durationMs}), 0)::float8`,
      p95Ms: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${performanceTransaction.durationMs}), 0)::float8`,
      failureRate: sql<number>`coalesce(100.0 * count(*) filter (
        where ${performanceTransaction.status} in ('internal_error', 'unknown_error', 'deadline_exceeded', 'unavailable')
           or ${performanceTransaction.statusCode} >= 500
      ) / nullif(count(*), 0), 0)::float8`
    })
      .from(performanceTransaction)
      .where(and(inArray(performanceTransaction.projectId, ids), gte(performanceTransaction.startTimestamp, since)))
      .groupBy(performanceTransaction.projectId),

    organizationProjectSeries(ids)
  ])

  const eventsById = new Map(eventRows.map(row => [row.projectId, row]))
  const performanceById = new Map(performanceRows.map(row => [row.projectId, row]))

  return rows.map((row) => {
    const events = eventsById.get(row.id)
    const performance = performanceById.get(row.id)
    return {
      ...row,
      canManage,
      events7d: Number(events?.events7d || 0),
      users7d: Number(events?.users7d || 0),
      series: seriesByProject[row.id] || [],
      // Absent for every project that never sent a transaction, which the card reads as "no tracing".
      performance: performance
        ? {
            requests7d: Number(performance.requests7d),
            averageMs: Number(performance.averageMs),
            p95Ms: Number(performance.p95Ms),
            failureRate: Number(performance.failureRate)
          }
        : null
    }
  })
})
