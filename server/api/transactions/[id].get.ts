import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db'
import { performanceSpan, performanceTransaction, project } from '../../db/schema'
import { requireOrganizationMember } from '../../lib/access'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const transaction = await db.query.performanceTransaction.findFirst({
    where: eq(performanceTransaction.id, id)
  })
  if (!transaction) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })

  const selectedProject = await db.query.project.findFirst({
    where: eq(project.id, transaction.projectId)
  })
  if (!selectedProject) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  await requireOrganizationMember(event, selectedProject.organizationId)

  const [spans, peers, [stats]] = await Promise.all([
    db.select().from(performanceSpan)
      .where(eq(performanceSpan.transactionId, id))
      .orderBy(asc(performanceSpan.startTimestamp)),
    db.select({
      id: performanceTransaction.id,
      durationMs: performanceTransaction.durationMs,
      status: performanceTransaction.status,
      statusCode: performanceTransaction.statusCode,
      startTimestamp: performanceTransaction.startTimestamp
    }).from(performanceTransaction)
      .where(and(
        eq(performanceTransaction.projectId, transaction.projectId),
        eq(performanceTransaction.name, transaction.name)
      ))
      .orderBy(desc(performanceTransaction.startTimestamp))
      .limit(20),
    db.select({
      requests: sql<number>`count(*)::int`,
      averageMs: sql<number>`avg(${performanceTransaction.durationMs})::float8`,
      p95Ms: sql<number>`percentile_cont(0.95) within group (order by ${performanceTransaction.durationMs})::float8`
    }).from(performanceTransaction)
      .where(and(
        eq(performanceTransaction.projectId, transaction.projectId),
        eq(performanceTransaction.name, transaction.name)
      ))
  ])

  return {
    project: selectedProject,
    transaction: { ...transaction, durationMs: Number(transaction.durationMs) },
    spans: spans.map(span => ({ ...span, durationMs: Number(span.durationMs) })),
    peers: peers.map(peer => ({ ...peer, durationMs: Number(peer.durationMs) })),
    stats: {
      requests: Number(stats?.requests || 0),
      averageMs: Number(stats?.averageMs || 0),
      p95Ms: Number(stats?.p95Ms || 0)
    }
  }
})
