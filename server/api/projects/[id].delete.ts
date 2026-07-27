import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { project } from '../../db/schema'
import { requireOrganizationMember } from '../../lib/access'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const selected = await db.query.project.findFirst({ where: eq(project.id, id) })
  if (!selected) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

  const { membership } = await requireOrganizationMember(event, selected.organizationId)
  const canDelete = membership.role.split(',').some(role => ['owner', 'admin'].includes(role))
  if (!canDelete) {
    throw createError({ statusCode: 403, statusMessage: 'Only team owners and admins can delete projects' })
  }

  await db.delete(project).where(eq(project.id, id))
  return { deleted: true }
})
