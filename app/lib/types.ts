/**
 * Shapes the pages actually read from Better Auth and from `/api/projects`.
 * They are deliberately narrower than the full server types: anything wider is
 * still assignable, and this keeps page code out of the auth client's generics.
 */

export type Organization = {
  id: string
  name: string
  slug: string
  logo?: string | null
}

export type Member = {
  id: string
  userId: string
  role: string
  user?: {
    id?: string
    name?: string
    email?: string
    image?: string | null
  }
}

export type Invitation = {
  id: string
  email: string
  role?: string | null
  status: string
}

export type Account = {
  providerId: string
}

/** A row of `GET /api/projects`. Dates arrive as JSON strings. */
export type ProjectSummary = {
  id: string
  name: string
  slug: string
  platform: string | null
  publicKey: string
  createdAt: string
  issueCount: number
  unresolvedCount: number
  lastSeen: string | null
}
