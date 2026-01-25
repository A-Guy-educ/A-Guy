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
import { decrypt } from './oauth_crypto'

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

  // Fetch the user to generate a proper JWT
  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    overrideAccess: true,
  })

  if (!user) {
    throw new Error('User not found for session generation')
  }

  // Generate JWT token using the same method as Payload's login
  // Import jose's SignJWT to replicate Payload's token generation
  const { SignJWT } = await import('jose')

  const secret = process.env.PAYLOAD_SECRET!
  if (!secret) {
    throw new Error('PAYLOAD_SECRET is not configured')
  }

  const secretKey = new TextEncoder().encode(secret)
  const issuedAt = Math.floor(Date.now() / 1000)
  const tokenExpiration = 7200 // 2 hours (default Payload expiration)
  const exp = issuedAt + tokenExpiration

  // Fields to include in JWT (same as Payload's login)
  const fieldsToSign = {
    id: user.id,
    email: user.email,
    collection: 'users',
  }

  const token = await new SignJWT(fieldsToSign)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(exp)
    .sign(secretKey)

  return { token }
}
