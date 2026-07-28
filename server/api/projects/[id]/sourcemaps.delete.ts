import { and, eq } from 'drizzle-orm'
import { db } from '../../../db'
import { project, sourceMapArtifact } from '../../../db/schema'
import { requireOrganizationRole } from '../../../lib/access'
import { forgetSourceMaps } from '../../../lib/sourcemap'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const selected = await db.query.project.findFirst({ where: eq(project.id, id) })
  if (!selected) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  await requireOrganizationRole(event, selected.organizationId, ['owner', 'admin'])

  const query = getQuery(event)
  if (typeof query.release !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Name the release to delete maps for' })
  }

  const removed = await db.delete(sourceMapArtifact)
    .where(and(eq(sourceMapArtifact.projectId, id), eq(sourceMapArtifact.release, query.release)))
    .returning({ id: sourceMapArtifact.id })

  forgetSourceMaps(removed.map(row => row.id))
  return { deleted: removed.length }
})
