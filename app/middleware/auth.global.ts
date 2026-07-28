import { authClient } from '../lib/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  const protectedRoute = ['/dashboard', '/onboarding', '/profile', '/team', '/projects/', '/issues/', '/performance/'].some(path => to.path === path || to.path.startsWith(path))
  if (!protectedRoute) return

  // Someone following an invitation link needs to reach onboarding to accept
  // it, even when they already belong to a team.
  const acceptingInvitation = to.path === '/onboarding' && !!to.query.invite

  if (import.meta.server) {
    const session = await useRequestFetch()<{ user?: unknown }>('/api/auth/get-session')
      .catch(() => null)
    if (!session?.user) return navigateTo('/sign-in')
    const organizations = await useRequestFetch()<unknown[]>('/api/auth/organization/list')
      .catch(() => null)
    if (organizations && !organizations.length && to.path !== '/onboarding') return navigateTo('/onboarding')
    if (organizations?.length && to.path === '/onboarding' && !acceptingInvitation) return navigateTo('/dashboard')
    return
  }

  const session = await authClient.getSession()
  if (!session.data?.user) return navigateTo('/sign-in')
  const organizations = await authClient.organization.list()
  if (!organizations.data?.length && to.path !== '/onboarding') return navigateTo('/onboarding')
  if (organizations.data?.length && to.path === '/onboarding' && !acceptingInvitation) return navigateTo('/dashboard')
})
