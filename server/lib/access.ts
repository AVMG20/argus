import { and, eq } from 'drizzle-orm'
import { auth } from './auth'
import { db } from '../db'
import { member } from '../db/schema'
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

/** Require a role in addition to organization membership for administrative actions. */
export async function requireOrganizationRole(event: H3Event, organizationId: string, roles: string[]) {
  const access = await requireOrganizationMember(event, organizationId)
  const memberRoles = access.membership.role.split(',').map(role => role.trim())

  if (!memberRoles.some(role => roles.includes(role))) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have permission to manage this team' })
  }

  return access
}
