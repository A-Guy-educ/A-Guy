/**
 * OAuth Session Creation
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Issue Payload auth sessions using payload.login() for OAuth users
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { decrypt, generateSecret } from './oauth_crypto'

export interface SessionResult {
  token: string
}

/**
 * Issue a valid Payload auth session using payload.login().
 *
 * For existing OAuth users:
 * - Decrypt the stored oauthLoginSecretEnc
 * - Use it with payload.login() to get a token
 *
 * @param email - User's stored email (from DB, not Google)
 * @param encryptedSecret - The oauthLoginSecretEnc value
 * @returns Session token
 */
export async function issueSession(email: string, encryptedSecret: string): Promise<SessionResult> {
  const payload = await getPayload({ config })

  // Decrypt the stored secret
  const plainSecret = decrypt(encryptedSecret)

  // Use payload.login() - this is the ONLY way /api/users/me validates tokens
  const loginResult = await payload.login({
    collection: 'users',
    data: {
      email,
      password: plainSecret,
    },
  })

  if (!loginResult || !('token' in loginResult) || !loginResult.token) {
    throw new Error('Session issuance failed: no token returned')
  }

  return { token: loginResult.token }
}

/**
 * Issue session for newly created OAuth user (we have the plain secret).
 */
export async function issueSessionWithPlainSecret(
  email: string,
  plainSecret: string,
): Promise<SessionResult> {
  const payload = await getPayload({ config })

  const loginResult = await payload.login({
    collection: 'users',
    data: {
      email,
      password: plainSecret,
    },
  })

  if (!loginResult || !('token' in loginResult) || !loginResult.token) {
    throw new Error('Session issuance failed: no token returned')
  }

  return { token: loginResult.token }
}

/**
 * Issue session for linked account (email/password user who added Google).
 *
 * For linked accounts:
 * - User keeps their original password for email/password login
 * - We can't use payload.login() because OAuth secret ≠ password
 * - Instead, generate token directly after verifying googleSub
 *
 * @param userId - User ID (already verified via googleSub lookup)
 * @returns Session token
 */
export async function issueSessionForLinkedAccount(userId: string): Promise<SessionResult> {
  const payload = await getPayload({ config })

  // CRITICAL: Payload's auth system strips hash/salt from findByID for security
  // We must read directly from MongoDB to access these fields
  const db = payload.db
  const { ObjectId } = await import('mongodb')

  const userDoc = await db.collections.users.findOne({ _id: new ObjectId(userId) })

  if (!userDoc) {
    throw new Error('User not found for session generation')
  }

  // Save original state from MongoDB (has hash/salt)
  const originalHash = userDoc.hash
  const originalSalt = userDoc.salt

  if (!originalHash || !originalSalt) {
    throw new Error('User missing password hash/salt - cannot issue session for linked account')
  }

  // Generate a temporary secret and use payload.login()
  // This ensures the JWT is 100% compatible with Payload's expectations
  const tempSecret = generateSecret()

  try {
    // Temporarily set OAuth secret as password
    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        password: tempSecret,
      },
      overrideAccess: true,
    })

    // Login to get real Payload JWT
    const loginResult = await payload.login({
      collection: 'users',
      data: {
        email: userDoc.email as string,
        password: tempSecret,
      },
    })

    if (!loginResult || !('token' in loginResult) || !loginResult.token) {
      throw new Error('Session issuance failed: no token returned')
    }

    // Restore original password hash using MongoDB direct update
    await db.collections.users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          hash: originalHash,
          salt: originalSalt,
        },
      },
    )

    return { token: loginResult.token }
  } catch (error) {
    // Try to restore password if login/token generation failed
    try {
      await db.collections.users.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            hash: originalHash,
            salt: originalSalt,
          },
        },
      )
    } catch (_restoreError) {
      // Silent failure - already in error state
    }
    throw error
  }
}
