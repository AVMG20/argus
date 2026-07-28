import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { project, projectUploadToken } from '../../../db/schema'
import { requireOrganizationRole } from '../../../lib/access'

function createToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return `argus_${[...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

/** Creates the project's upload token, or rotates it when one already exists. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const selected = await db.query.project.findFirst({ where: eq(project.id, id) })
  if (!selected) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  await requireOrganizationRole(event, selected.organizationId, ['owner', 'admin'])

  const token = createToken()
  const [row] = await db.insert(projectUploadToken).values({
    id: crypto.randomUUID(),
    projectId: id,
    token
  }).onConflictDoUpdate({
    target: projectUploadToken.projectId,
    set: { token, createdAt: new Date(), lastUsedAt: null }
  }).returning()

  return { value: row!.token, createdAt: row!.createdAt, lastUsedAt: row!.lastUsedAt }
})
