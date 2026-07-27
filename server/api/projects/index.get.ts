import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db'
import { issue, project } from '../../db/schema'
import { requireOrganizationMember } from '../../lib/access'

export default defineEventHandler(async (event) => {
  const organizationId = getQuery(event).organizationId?.toString()
  if (!organizationId) throw createError({ statusCode: 400, statusMessage: 'organizationId is required' })
  await requireOrganizationMember(event, organizationId)

  return db.select({
    id: project.id,
    name: project.name,
    slug: project.slug,
    platform: project.platform,
    publicKey: project.publicKey,
    createdAt: project.createdAt,
    issueCount: sql<number>`count(${issue.id})::int`,
    unresolvedCount: sql<number>`count(${issue.id}) filter (where ${issue.status} = 'unresolved')::int`,
    lastSeen: sql<Date | null>`max(${issue.lastSeen})`
  })
    .from(project)
    .leftJoin(issue, eq(issue.projectId, project.id))
    .where(eq(project.organizationId, organizationId))
    .groupBy(project.id)
    .orderBy(desc(project.createdAt))
})
