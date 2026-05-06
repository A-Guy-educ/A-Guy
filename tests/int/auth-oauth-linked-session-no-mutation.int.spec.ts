/**
 * Regression guard for the OAuth linked-account password corruption bug
 * (PR #1137, fixed in commit a8f55db3).
 *
 * Pre-fix code in issueSessionForLinkedAccount used a "password swap" pattern:
 *   1. Set user.password = tempSecret (Payload re-hashes into hash/salt)
 *   2. payload.login() with tempSecret to get a JWT
 *   3. Restore original hash/salt via direct MongoDB updateOne
 *
 * Step 3 was not atomic with step 1. Concurrent calls or any failure between
 * steps 1 and 3 left the user's hash/salt as the throwaway-secret hash —
 * permanent corruption that locked the user out of email/password login.
 *
 * This test asserts the mutation cannot recur:
 *   - Capture the user's hash/salt before the call
 *   - Issue 5 concurrent linked-account sessions for the same user
 *   - Verify hash/salt are byte-identical afterward
 *   - Verify the user's original password still authenticates
 *
 * It PASSES on current code (which uses jose to sign JWTs directly without
 * touching the password) and would FAIL on the pre-Apr-21 password-swap code.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { ObjectId } from 'mongodb'

import { getSharedPayload } from '../setup/shared-payload'
import { issueSessionForLinkedAccount } from '@/infra/auth/oauth_session'

describe('OAuth linked-account session — no password mutation', () => {
  let payload: Payload
  const createdUserIds: string[] = []

  beforeAll(async () => {
    payload = await getSharedPayload()
  })

  afterAll(async () => {
    for (const userId of createdUserIds) {
      try {
        await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
      } catch {
        // already cleaned up
      }
    }
  })

  it('does not mutate hash/salt under concurrent linked-account session calls', async () => {
    const email = `linked-no-mutation-${Date.now()}@example.com`
    const originalPassword = 'original-password-abc-123'

    // 1. Create an email/password user.
    const created = (await payload.create({
      collection: 'users',
      data: {
        email,
        name: 'Linked Account User',
        password: originalPassword,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    })) as { id: string }
    createdUserIds.push(created.id)

    // 2. Link a Google account (this is the state handleCollision leaves a user in).
    await payload.update({
      collection: 'users',
      id: created.id,
      data: {
        googleSub: `linked-no-mutation-sub-${Date.now()}`,
        verifiedEmail: email,
        googleProfile: { name: 'Linked User' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    })

    // 3. Capture the on-disk hash/salt BEFORE issuing any sessions.
    const db = payload.db
    const before = await db.collections.users.findOne({ _id: new ObjectId(created.id) })
    expect(before).toBeTruthy()
    const beforeHash = before!.hash as string
    const beforeSalt = before!.salt as string
    expect(beforeHash).toBeTruthy()
    expect(beforeSalt).toBeTruthy()

    // 4. Issue 5 linked-account sessions concurrently. The pre-fix swap pattern
    //    would interleave hash/salt mutations across these calls and almost
    //    certainly leave the password corrupted.
    const tokens = await Promise.all([
      issueSessionForLinkedAccount(created.id),
      issueSessionForLinkedAccount(created.id),
      issueSessionForLinkedAccount(created.id),
      issueSessionForLinkedAccount(created.id),
      issueSessionForLinkedAccount(created.id),
    ])
    for (const result of tokens) {
      expect(result.token).toBeTruthy()
    }

    // 5. The hash/salt must be byte-identical to before.
    const after = await db.collections.users.findOne({ _id: new ObjectId(created.id) })
    expect(after).toBeTruthy()
    expect(after!.hash).toBe(beforeHash)
    expect(after!.salt).toBe(beforeSalt)

    // 6. The original password must still authenticate.
    const loginResult = await payload.login({
      collection: 'users',
      data: { email, password: originalPassword },
    })
    expect(loginResult.token).toBeTruthy()
  })
})
