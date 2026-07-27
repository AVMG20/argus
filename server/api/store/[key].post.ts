import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { project } from '../../db/schema'
import { ingestEvent, type EventPayload } from '../../lib/ingest'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-sentry-auth'
  })

  const key = getRouterParam(event, 'key')!
  const selectedProject = await db.query.project.findFirst({ where: eq(project.publicKey, key) })
  if (!selectedProject) throw createError({ statusCode: 404, statusMessage: 'Unknown project key' })

  const result = await ingestEvent(selectedProject, await readBody<EventPayload>(event))
  setResponseStatus(event, 202)
  return result
})
