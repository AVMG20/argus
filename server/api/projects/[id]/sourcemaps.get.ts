import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../../../db'
import { project, projectUploadToken, sourceMapArtifact } from '../../../db/schema'
import { requireOrganizationMember } from '../../../lib/access'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const selected = await db.query.project.findFirst({ where: eq(project.id, id) })
  if (!selected) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  const { membership } = await requireOrganizationMember(event, selected.organizationId)

  const [releases, token] = await Promise.all([
    db.select({
      release: sourceMapArtifact.release,
      files: sql<number>`count(*)::int`,
      size: sql<number>`coalesce(sum(${sourceMapArtifact.size}), 0)::int`,
      uploadedAt: sql<string>`max(${sourceMapArtifact.createdAt})`
    })
      .from(sourceMapArtifact)
      .where(eq(sourceMapArtifact.projectId, id))
      .groupBy(sourceMapArtifact.release)
      .orderBy(desc(sql`max(${sourceMapArtifact.createdAt})`)),

    db.query.projectUploadToken.findFirst({ where: eq(projectUploadToken.projectId, id) })
  ])

  return {
    releases: releases.map(row => ({ ...row, release: row.release || null })),
    token: token ? { value: token.token, createdAt: token.createdAt, lastUsedAt: token.lastUsedAt } : null,
    permissions: {
      canManageToken: membership.role.split(',').some(role => ['owner', 'admin'].includes(role.trim()))
    }
  }
})
