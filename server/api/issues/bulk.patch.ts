import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db'
import { issue, project } from '../../db/schema'
import { requireOrganizationMember } from '../../lib/access'

type BulkIssueStatusBody = {
  ids?: string[]
  status?: 'resolved' | 'unresolved'
}

export default defineEventHandler(async (event) => {
  const body = await readBody<BulkIssueStatusBody>(event)
  const ids = [...new Set(body.ids || [])]

  if (!ids.length) {
    throw createError({ statusCode: 400, statusMessage: 'Select at least one issue' })
  }
  if (!body.status || !['resolved', 'unresolved'].includes(body.status)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  }

  const selectedIssues = await db.select({
    id: issue.id,
    organizationId: project.organizationId
  })
    .from(issue)
    .innerJoin(project, eq(project.id, issue.projectId))
    .where(inArray(issue.id, ids))

  if (selectedIssues.length !== ids.length) {
    throw createError({ statusCode: 404, statusMessage: 'One or more issues no longer exist' })
  }

  const organizationIds = [...new Set(selectedIssues.map(item => item.organizationId))]
  await Promise.all(organizationIds.map(organizationId => requireOrganizationMember(event, organizationId)))

  const updated = await db.update(issue)
    .set({ status: body.status })
    .where(inArray(issue.id, ids))
    .returning({ id: issue.id })

  return { updated: updated.length, status: body.status }
})
