import { authClient } from '../lib/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/sign-in') {
    if (import.meta.server) {
      const session = await useRequestFetch()<{ user?: unknown }>('/api/auth/get-session')
        .catch(() => null)
      if (session?.user) return navigateTo('/dashboard')
      return
    }

    const session = await authClient.getSession()
    if (session.data?.user) return navigateTo('/dashboard')
    return
  }

  const protectedRoute = ['/dashboard', '/onboarding', '/profile', '/team', '/projects/', '/issues/'].some(path => to.path === path || to.path.startsWith(path))
  if (!protectedRoute) return

  if (import.meta.server) {
    const session = await useRequestFetch()<{ user?: unknown }>('/api/auth/get-session')
      .catch(() => null)
    if (!session?.user) return navigateTo('/sign-in')
    const organizations = await useRequestFetch()<unknown[]>('/api/auth/organization/list')
      .catch(() => null)
    if (organizations && !organizations.length && to.path !== '/onboarding') return navigateTo('/onboarding')
    if (organizations?.length && to.path === '/onboarding') return navigateTo('/dashboard')
    return
  }

  const session = await authClient.getSession()
  if (!session.data?.user) return navigateTo('/sign-in')
  const organizations = await authClient.organization.list()
  if (!organizations.data?.length && to.path !== '/onboarding') return navigateTo('/onboarding')
  if (organizations.data?.length && to.path === '/onboarding') return navigateTo('/dashboard')
})
