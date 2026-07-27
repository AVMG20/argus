import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { issue, project } from '../../db/schema'
import { requireOrganizationMember } from '../../lib/access'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const [selected] = await db.select({ issue, project })
    .from(issue)
    .innerJoin(project, eq(project.id, issue.projectId))
    .where(eq(issue.id, id))
    .limit(1)
  if (!selected) throw createError({ statusCode: 404, statusMessage: 'Issue not found' })
  await requireOrganizationMember(event, selected.project.organizationId)

  const body = await readBody<{ status?: 'resolved' | 'unresolved' }>(event)
  if (!body.status || !['resolved', 'unresolved'].includes(body.status)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  }
  const [updated] = await db.update(issue).set({ status: body.status }).where(eq(issue.id, id)).returning()
  return updated
})
