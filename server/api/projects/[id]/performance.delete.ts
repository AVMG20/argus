import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { performanceTransaction, project } from '../../../db/schema'
import { requireOrganizationRole } from '../../../lib/access'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const selected = await db.query.project.findFirst({ where: eq(project.id, id) })
  if (!selected) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

  await requireOrganizationRole(event, selected.organizationId, ['owner', 'admin'])

  await db.delete(performanceTransaction).where(eq(performanceTransaction.projectId, id))

  return { deleted: true }
})
