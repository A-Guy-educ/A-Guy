/**
 * OAuth Session Creation
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Issue Payload auth sessions using payload.login() for OAuth users
 */

import crypto from 'crypto'
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
  sid,
  secret,
}: {
  userId: string
  email: string
  role: string
  sid?: string
  secret: string
}): Promise<string> {
  // Payload derives the JWT signing key from config.secret this way
  // (see payload/dist/index.js: this.secret = sha256(config.secret).hex.slice(0, 32)).
  // We must mirror that derivation so tokens pass payload.auth() verification.
  const derivedSecret = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 32)
  const secretKey = new TextEncoder().encode(derivedSecret)
  const issuedAt = Math.floor(Date.now() / 1000)
  const exp = issuedAt + TOKEN_EXPIRATION

  const claims: Record<string, unknown> = {
    id: userId,
    collection: 'users',
    email,
    role,
  }
  if (sid) {
    claims.sid = sid
  }

  const token = await new SignJWT(claims)
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

  // Payload's users collection has useSessions: true (the default in v3).
  // The JWT strategy rejects tokens whose `sid` does not match an existing
  // session record on the user, so we must add one and include its id in the
  // token claims. Mirrors payload/dist/auth/sessions.js#addSessionToUser.
  const usersCollection = payload.collections?.users
  const useSessions = usersCollection?.config?.auth?.useSessions === true
  let sid: string | undefined
  if (useSessions) {
    const { randomUUID } = await import('crypto')
    sid = randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + TOKEN_EXPIRATION * 1000)
    await db.collections.users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: {
          sessions: { id: sid, createdAt: now, expiresAt },
        },
      },
    )
  }

  // Generate JWT directly - no password swap needed
  // This is safe for concurrent requests and serverless environments
  const token = await generateJWTToken({
    userId,
    email,
    role: role || 'student',
    sid,
    secret,
  })

  return { token }
}
