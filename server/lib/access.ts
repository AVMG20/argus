import { and, eq } from 'drizzle-orm'
import { auth } from './auth'
import { db } from '../db'
import { member, projectUploadToken, type project } from '../db/schema'
import type { H3Event } from 'h3'

export async function requireOrganizationMember(event: H3Event, organizationId: string) {
  const session = await auth.api.getSession({ headers: new Headers(getRequestHeaders(event) as Record<string, string>) })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }

  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id))
  })

  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to this team' })
  }

  return { session, membership }
}

/**
 * Build pipelines have no session, so uploads authenticate with the project's bearer
 * token. A signed-in team member is still accepted for uploads made from the UI.
 */
export async function requireProjectUpload(event: H3Event, selected: typeof project.$inferSelect) {
  const bearer = getHeader(event, 'authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (!bearer) {
    await requireOrganizationMember(event, selected.organizationId)
    return
  }

  const token = await db.query.projectUploadToken.findFirst({
    where: and(eq(projectUploadToken.token, bearer), eq(projectUploadToken.projectId, selected.id))
  })
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Invalid upload token for this project' })

  await db.update(projectUploadToken)
    .set({ lastUsedAt: new Date() })
    .where(eq(projectUploadToken.id, token.id))
}

/** Membership roles are stored as one comma separated string, so they need splitting to compare. */
export function hasOrganizationRole(membership: typeof member.$inferSelect, roles: string[]) {
  return membership.role.split(',').some(role => roles.includes(role.trim()))
}

/** Require a role in addition to organization membership for administrative actions. */
export async function requireOrganizationRole(event: H3Event, organizationId: string, roles: string[]) {
  const access = await requireOrganizationMember(event, organizationId)

  if (!hasOrganizationRole(access.membership, roles)) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have permission to manage this team' })
  }

  return access
}
