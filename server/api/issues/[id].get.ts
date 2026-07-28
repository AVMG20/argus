import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db'
import { errorEvent, issue, project } from '../../db/schema'
import { requireOrganizationMember } from '../../lib/access'
import { issueDistribution, issueSeries } from '../../lib/analytics'
import { applySourceMaps } from '../../lib/sourcemap'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const [selected] = await db.select({ issue, project })
    .from(issue)
    .innerJoin(project, eq(project.id, issue.projectId))
    .where(eq(issue.id, id))
    .limit(1)

  if (!selected) throw createError({ statusCode: 404, statusMessage: 'Issue not found' })
  await requireOrganizationMember(event, selected.project.organizationId)

  const [events, [rollup], series, distribution] = await Promise.all([
    db.select().from(errorEvent)
      .where(eq(errorEvent.issueId, id))
      .orderBy(desc(errorEvent.timestamp))
      .limit(50),
    db.select({
      storedEvents: sql<number>`count(*)::int`,
      userCount: sql<number>`count(distinct coalesce(${errorEvent.user}->>'id', ${errorEvent.user}->>'email', ${errorEvent.user}->>'username'))::int`,
      events24h: sql<number>`count(*) filter (where ${errorEvent.timestamp} >= now() - interval '24 hours')::int`,
      environments: sql<string[]>`coalesce(array_agg(distinct ${errorEvent.environment}) filter (where ${errorEvent.environment} is not null), '{}')`,
      releases: sql<string[]>`coalesce(array_agg(distinct ${errorEvent.release}) filter (where ${errorEvent.release} is not null), '{}')`,
      firstRelease: sql<string | null>`(array_agg(${errorEvent.release} order by ${errorEvent.timestamp} asc) filter (where ${errorEvent.release} is not null))[1]`,
      lastRelease: sql<string | null>`(array_agg(${errorEvent.release} order by ${errorEvent.timestamp} desc) filter (where ${errorEvent.release} is not null))[1]`
    }).from(errorEvent).where(eq(errorEvent.issueId, id)),
    issueSeries(id),
    issueDistribution(id)
  ])

  return {
    project: selected.project,
    issue: selected.issue,
    // Resolved on read so maps uploaded after the fact still fix already-stored events.
    events: await applySourceMaps(selected.project.id, events),
    stats: {
      storedEvents: 0,
      userCount: 0,
      events24h: 0,
      environments: [] as string[],
      releases: [] as string[],
      firstRelease: null as string | null,
      lastRelease: null as string | null,
      ...rollup
    },
    series,
    distribution
  }
})
