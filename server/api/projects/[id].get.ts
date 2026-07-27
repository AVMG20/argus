import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db'
import { errorEvent, issue, project } from '../../db/schema'
import { requireOrganizationMember } from '../../lib/access'
import { projectIssueSeries, projectSeries } from '../../lib/analytics'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const selected = await db.query.project.findFirst({ where: eq(project.id, id) })
  if (!selected) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  const { membership } = await requireOrganizationMember(event, selected.organizationId)
  const canDelete = membership.role.split(',').some(role => ['owner', 'admin'].includes(role))

  const [rows, [issueStats], [eventStats], series, issueSeriesById] = await Promise.all([
    db.select({
      id: issue.id,
      title: issue.title,
      culprit: issue.culprit,
      level: issue.level,
      status: issue.status,
      eventCount: issue.eventCount,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
      environments: sql<string[]>`coalesce(array_agg(distinct ${errorEvent.environment}) filter (where ${errorEvent.environment} is not null), '{}')`,
      userCount: sql<number>`count(distinct coalesce(${errorEvent.user}->>'id', ${errorEvent.user}->>'email', ${errorEvent.user}->>'username'))::int`,
      events24h: sql<number>`count(*) filter (where ${errorEvent.timestamp} >= now() - interval '24 hours')::int`,
      lastRelease: sql<string | null>`(array_agg(${errorEvent.release} order by ${errorEvent.timestamp} desc) filter (where ${errorEvent.release} is not null))[1]`,
      lastTransaction: sql<string | null>`(array_agg(${errorEvent.transaction} order by ${errorEvent.timestamp} desc) filter (where ${errorEvent.transaction} is not null))[1]`,
      unhandled: sql<boolean>`coalesce(bool_or(exists (
        select 1 from jsonb_array_elements(coalesce(${errorEvent.exceptions}, '[]'::jsonb)) as chain
        where chain->'mechanism'->>'handled' = 'false'
      )), false)`
    })
      .from(issue)
      .leftJoin(errorEvent, eq(errorEvent.issueId, issue.id))
      .where(and(eq(issue.projectId, id)))
      .groupBy(issue.id)
      .orderBy(desc(issue.lastSeen)),

    db.select({
      unresolved: sql<number>`count(*) filter (where ${issue.status} = 'unresolved')::int`,
      resolved: sql<number>`count(*) filter (where ${issue.status} = 'resolved')::int`,
      newToday: sql<number>`count(*) filter (where ${issue.firstSeen} >= now() - interval '24 hours')::int`,
      totalEvents: sql<number>`coalesce(sum(${issue.eventCount}), 0)::int`
    }).from(issue).where(eq(issue.projectId, id)),

    db.select({
      events24h: sql<number>`count(*) filter (where ${errorEvent.timestamp} >= now() - interval '24 hours')::int`,
      affectedUsers: sql<number>`count(distinct coalesce(${errorEvent.user}->>'id', ${errorEvent.user}->>'email', ${errorEvent.user}->>'username'))::int`
    }).from(errorEvent)
      .innerJoin(issue, eq(issue.id, errorEvent.issueId))
      .where(eq(issue.projectId, id)),

    projectSeries(id),
    projectIssueSeries(id)
  ])

  const issues = rows.map(row => ({ ...row, series: issueSeriesById[row.id] || Array.from({ length: 24 }, () => 0) }))
  const releases = [...new Set(issues.map(item => item.lastRelease).filter((value): value is string => Boolean(value)))].sort()
  const environments = [...new Set(issues.flatMap(item => item.environments))].sort()

  return {
    project: selected,
    issues,
    series,
    facets: { releases, environments },
    stats: { ...issueStats, ...eventStats },
    permissions: { canDelete }
  }
})
