import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { betterAuth } from 'better-auth'
import { organization } from 'better-auth/plugins'
import { db } from '../db'
import * as schema from '../db/schema'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET ?? 'development-only-secret-change-this-before-production',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema
  }),
  emailAndPassword: {
    enabled: true
  },
  plugins: [
    organization({
      // Invitations are stored in the database; no email provider is configured.
      teams: {
        enabled: true,
        defaultTeam: {
          enabled: true
        }
      }
    })
  ]
})
