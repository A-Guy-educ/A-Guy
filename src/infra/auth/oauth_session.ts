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
import { SignJWT } from 'jose'
import { decrypt } from './oauth_crypto'

// Default token expiration in seconds (matches Payload's default)
const TOKEN_EXPIRATION = 7200

/**
 * Generate a JWT token directly using jose (same algorithm as Payload).
 * This avoids the dangerous password-swap pattern that risks locking out users.
 */
async function generateJWTToken({
  userId,
  email,
  role,
  secret,
}: {
  userId: string
  email: string
  role: string
  secret: string
}): Promise<string> {
  const secretKey = new TextEncoder().encode(secret)
  const issuedAt = Math.floor(Date.now() / 1000)
  const exp = issuedAt + TOKEN_EXPIRATION

  const token = await new SignJWT({
    id: userId,
    collection: 'users',
    email,
    role,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(exp)
    .sign(secretKey)

  return token
}

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
 * - Instead, generate token directly using jose (same algorithm as Payload)
 *
 * SECURITY: This function generates the JWT directly without any password swap,
 * avoiding the race condition that could lock users out during concurrent requests.
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

  const email = userDoc.email as string
  const role = userDoc.role as string

  if (!email) {
    throw new Error('User missing email - cannot issue session for linked account')
  }

  // Get Payload secret from environment
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) {
    throw new Error('PAYLOAD_SECRET environment variable is required')
  }

  // Generate JWT directly - no password swap needed
  // This is safe for concurrent requests and serverless environments
  const token = await generateJWTToken({
    userId,
    email,
    role: role || 'student',
    secret,
  })

  return { token }
}
