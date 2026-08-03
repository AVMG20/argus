import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../../../db'
import { project, projectUploadToken, sourceMapArtifact } from '../../../db/schema'
import { hasOrganizationRole, requireOrganizationMember } from '../../../lib/access'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const selected = await db.query.project.findFirst({ where: eq(project.id, id) })
  if (!selected) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  const { membership } = await requireOrganizationMember(event, selected.organizationId)
  const canManageToken = hasOrganizationRole(membership, ['owner', 'admin'])

  const [releases, token] = await Promise.all([
    db.select({
      release: sourceMapArtifact.release,
      files: sql<number>`count(*)::int`,
      // Cast to bigint, not int: a few dozen builds of a large bundle pass the 2GB an
      // int can hold, and the overflow would fail the whole request.
      size: sql<string>`coalesce(sum(${sourceMapArtifact.size}), 0)::bigint`,
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
    token: token
      ? {
          // The plaintext value is the upload credential itself, so it goes only to the
          // roles that are allowed to rotate it. Everyone else sees that one exists.
          value: canManageToken ? token.token : null,
          createdAt: token.createdAt,
          lastUsedAt: token.lastUsedAt
        }
      : null,
    permissions: { canManageToken }
  }
})
