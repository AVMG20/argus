import { eq } from 'drizzle-orm'
import { db } from '../db'
import { user } from '../db/schema'

/**
 * This instance has no email provider, so email verification can never
 * complete. better-auth refuses to list or accept organization invitations
 * for unverified accounts, which leaves invited people staring at an empty
 * onboarding screen. New accounts are marked verified on creation (see
 * server/lib/auth.ts); this backfills accounts created before that.
 */
export default defineNitroPlugin(async () => {
  try {
    const updated = await db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.emailVerified, false))
      .returning({ id: user.id })

    if (updated.length) {
      console.log(`[argus] Marked ${updated.length} existing account(s) as verified — this instance does not send email.`)
    }
  } catch (error) {
    console.error('[argus] Could not backfill email verification for existing accounts.', error)
  }
})
