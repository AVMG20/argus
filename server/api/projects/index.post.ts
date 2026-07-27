import { db } from '../../db'
import { project } from '../../db/schema'
import { requireOrganizationRole } from '../../lib/access'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ organizationId?: string, name?: string, platform?: string }>(event)
  const organizationId = body.organizationId?.trim()
  const name = body.name?.trim()
  if (!organizationId || !name) throw createError({ statusCode: 400, statusMessage: 'Team and project name are required' })
  await requireOrganizationRole(event, organizationId, ['owner', 'admin'])

  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project'
  const [created] = await db.insert(project).values({
    id: crypto.randomUUID(),
    organizationId,
    name,
    slug: `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`,
    platform: body.platform || 'javascript',
    publicKey: crypto.randomUUID().replaceAll('-', '')
  }).returning()

  return created
})
