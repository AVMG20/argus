import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { project } from '../../db/schema'
import { requireOrganizationRole } from '../../lib/access'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const selected = await db.query.project.findFirst({ where: eq(project.id, id) })
  if (!selected) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  await requireOrganizationRole(event, selected.organizationId, ['owner', 'admin'])

  const name = (await readBody<{ name?: string }>(event)).name?.trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'A project name is required' })

  // The slug and the DSN stay as they are: renaming must not break a deployed SDK config.
  const [updated] = await db.update(project).set({ name }).where(eq(project.id, id)).returning()
  return updated
})
