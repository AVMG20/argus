import { and, eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { project } from '../../../../db/schema'
import { ingestEvent, type EventPayload } from '../../../../lib/ingest'
import { ingestTransaction, type TransactionPayload } from '../../../../lib/ingest-performance'

function projectKeyFromDsn(dsn?: string) {
  if (!dsn) return
  try {
    return new URL(dsn).username
  } catch {
    return
  }
}

function projectKeyFromAuthHeader(value?: string) {
  return value?.match(/(?:^|,\s*)sentry_key=([^,\s]+)/)?.[1]
}

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-sentry-auth'
  })

  const projectId = Number(getRouterParam(event, 'projectId'))
  const lines = (await readRawBody(event, 'utf8'))?.split('\n').filter(Boolean) || []
  const envelopeHeader = JSON.parse(lines[0] || '{}')
  const query = getQuery(event)
  const queryKey = typeof query.sentry_key === 'string' ? query.sentry_key : undefined
  const key = projectKeyFromDsn(envelopeHeader.dsn)
    || queryKey
    || projectKeyFromAuthHeader(getHeader(event, 'x-sentry-auth'))
  const selectedProject = await db.query.project.findFirst({
    where: and(eq(project.sentryProjectId, projectId), eq(project.publicKey, key || ''))
  })
  if (!selectedProject) throw createError({ statusCode: 404, statusMessage: 'Unknown Sentry DSN' })

  const accepted: Array<{ id: string }> = []
  for (let index = 1; index < lines.length; index += 2) {
    const itemHeader = JSON.parse(lines[index] || '{}')
    if (!['event', 'transaction'].includes(itemHeader.type) || !lines[index + 1]) continue
    const payload = JSON.parse(lines[index + 1]!)
    accepted.push(itemHeader.type === 'transaction'
      ? await ingestTransaction(selectedProject, payload as TransactionPayload)
      : await ingestEvent(selectedProject, payload as EventPayload))
  }

  setResponseStatus(event, 202)
  return { id: accepted[0]?.id || envelopeHeader.event_id }
})
