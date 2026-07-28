import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { betterAuth } from 'better-auth'
import { organization } from 'better-auth/plugins'
import { db } from '../db'
import * as schema from '../db/schema'

const isProduction = process.env.NODE_ENV === 'production'
const authSecret = process.env.BETTER_AUTH_SECRET

if (isProduction && !authSecret) {
  throw new Error('BETTER_AUTH_SECRET must be set in production')
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: authSecret ?? 'development-only-secret-change-this-before-production',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema
  }),
  emailAndPassword: {
    enabled: true
  },
  databaseHooks: {
    user: {
      create: {
        // No email provider is configured, so verification can never complete.
        // Accounts on this instance are considered verified on creation —
        // otherwise better-auth blocks listing and accepting invitations.
        before: async (newUser) => ({ data: { ...newUser, emailVerified: true } })
      }
    }
  },
  plugins: [
    organization({
      // Invitations are stored in the database; no email provider is configured.
      requireEmailVerificationOnInvitation: false,
      teams: {
        enabled: true,
        defaultTeam: {
          enabled: true
        }
      }
    })
  ]
})
