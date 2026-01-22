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
