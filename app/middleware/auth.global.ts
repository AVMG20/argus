import { authClient } from '../lib/auth-client'

// Argus is entirely an authenticated tool: every route belongs to the app and
// only the sign-in screen is reachable while signed out. Keeping the list an
// allowlist means a new page is protected by default instead of by memory.
const publicRoutes = ['/sign-in']

export default defineNuxtRouteMiddleware(async (to) => {
  if (publicRoutes.includes(to.path)) return

  // Someone following an invitation link needs to reach onboarding to accept
  // it, even when they already belong to a team.
  const acceptingInvitation = to.path === '/onboarding' && !!to.query.invite

  // Send people back where they were headed once they have signed in.
  const signIn = to.fullPath === '/'
    ? '/sign-in'
    : `/sign-in?redirect=${encodeURIComponent(to.fullPath)}`

  if (import.meta.server) {
    const session = await useRequestFetch()<{ user?: unknown }>('/api/auth/get-session')
      .catch(() => null)
    if (!session?.user) return navigateTo(signIn)
    const organizations = await useRequestFetch()<unknown[]>('/api/auth/organization/list')
      .catch(() => null)
    if (organizations && !organizations.length && to.path !== '/onboarding') return navigateTo('/onboarding')
    if (organizations?.length && to.path === '/onboarding' && !acceptingInvitation) return navigateTo('/')
    return
  }

  const session = await authClient.getSession()
  if (!session.data?.user) return navigateTo(signIn)
  const organizations = await authClient.organization.list()
  if (!organizations.data?.length && to.path !== '/onboarding') return navigateTo('/onboarding')
  if (organizations.data?.length && to.path === '/onboarding' && !acceptingInvitation) return navigateTo('/')
})
