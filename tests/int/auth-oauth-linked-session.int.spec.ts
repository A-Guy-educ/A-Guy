/**
 * Regression test for commit a8f55db3 (PR #1137).
 *
 * The custom jose signer introduced in issueSessionForLinkedAccount must
 * produce tokens that Payload can verify. Payload derives its JWT key as:
 *
 *   sha256(config.secret).hex.slice(0, 32)
 *
 * Signing with the raw PAYLOAD_SECRET instead yields tokens whose signatures
 * do not match, so payload.auth() returns user: null and the browser stays
 * in a logged-out state after a successful OAuth callback — the exact symptom
 * reported in prod.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getSharedPayload } from '../setup/shared-payload'
import { issueSessionForLinkedAccount } from '@/infra/auth/oauth_session'

describe('OAuth linked-account session', () => {
  let payload: Payload
  const createdUserIds: string[] = []

  beforeAll(async () => {
    payload = await getSharedPayload()
  })

  it('produces a token that payload.auth() accepts', async () => {
    const email = `linked-session-${Date.now()}@example.com`

    // 1. Create an email/password user (no Google yet).
    const emailUser = (await payload.create({
      collection: 'users',
      data: {
        email,
        name: 'Linked Session User',
        password: 'original-password-123',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)) as { id: string }
    createdUserIds.push(emailUser.id)

    // 2. Link Google to the existing user (googleSub set, oauthLoginSecretEnc NOT set).
    // This is the state handleCollision leaves a linked account in.
    await payload.update({
      collection: 'users',
      id: emailUser.id,
      data: {
        googleSub: `linked-sub-${Date.now()}`,
        verifiedEmail: email,
        googleProfile: { name: 'Linked User' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    })

    // 3. Issue a session token via the linked-account path.
    const { token } = await issueSessionForLinkedAccount(emailUser.id)
    expect(token).toBeTruthy()

    // 4. Verify the token the same way /api/users/me does internally.
    const headers = new Headers({ Authorization: `JWT ${token}` })
    const authResult = await payload.auth({ headers })

    // 5. Token must identify the user. Under the bug, user is null.
    expect(authResult.user).not.toBeNull()
    expect(authResult.user?.collection).toBe('users')
    const authedUser = authResult.user as { id: string; email: string } | null
    expect(authedUser?.id).toBe(emailUser.id)
    expect(authedUser?.email).toBe(email)
  })

  afterAll(async () => {
    for (const userId of createdUserIds) {
      try {
        await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
      } catch {
        // already cleaned up or user never created
      }
    }
  })
})
