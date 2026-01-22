/**
 * OAuth Callback Helper Functions
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Helper functions for OAuth callback to handle user lookup and creation
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { issueSession, issueSessionWithPlainSecret } from '@/lib/auth/oauth_session'
import { setAuthCookie } from '@/lib/auth/oauth_cookies'
import { logOAuthEvent, logOAuthError } from '@/lib/auth/oauth_logger'
import { generateSecret, encrypt } from '@/lib/auth/oauth_crypto'

export async function handleExistingUser(
  payload: Payload,
  req: NextRequest,
  res: NextResponse,
  user: User,
  profile: { name?: string; picture?: string },
  returnTo: string,
  correlationId: string,
  sub: string,
): Promise<NextResponse> {
  // Verify oauthLoginSecretEnc exists and is readable
  if (!user.oauthLoginSecretEnc) {
    logOAuthError('user_missing_oauth_secret', 'OAuth user missing stored secret', correlationId)
    res.headers.set('Location', new URL('/login?error=auth_error', req.url).toString())
    return res
  }

  // Update profile only (name/picture from Google)
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { googleProfile: { name: profile.name, picture: profile.picture } },
  })

  await logOAuthEvent('user_updated', { correlationId, userId: user.id, googleSub: sub })

  // Issue session using stored encrypted secret
  // CRITICAL: Use user.email (from DB), NOT userinfo.email (Google may change)
  try {
    const { token } = await issueSession(user.email, user.oauthLoginSecretEnc)
    res.headers.set('Location', new URL(returnTo, req.url).toString())
    setAuthCookie(res, payload, token)
    return res
  } catch (error) {
    logOAuthError('session_issuance_failed', error, correlationId)
    res.headers.set('Location', new URL('/login?error=session_issue_failed', req.url).toString())
    return res
  }
}

export function handleCollision(
  req: NextRequest,
  res: NextResponse,
  existingUser: User,
  sub: string,
  correlationId: string,
  email: string,
): NextResponse {
  // COLLISION - BLOCK (no linking, no mutation)
  const googleSubMissing =
    existingUser.googleSub === null ||
    existingUser.googleSub === undefined ||
    existingUser.googleSub === ''

  if (googleSubMissing || existingUser.googleSub !== sub) {
    logOAuthEvent('collision', { correlationId, email, googleSub: sub })
    res.headers.set('Location', new URL('/login?error=account_exists', req.url).toString())
    return res
  }

  return res
}

export async function createNewOAuthUser(
  payload: Payload,
  req: NextRequest,
  res: NextResponse,
  userinfo: { sub: string; email: string; name?: string; picture?: string },
  returnTo: string,
  correlationId: string,
): Promise<NextResponse> {
  const { sub, email, name, picture } = userinfo
  let userId: string
  const plainSecret = generateSecret()
  const encryptedSecret = encrypt(plainSecret)

  try {
    // @ts-expect-error - Payload type inference issue with OAuth fields
    const newUser = await payload.create({
      collection: 'users',
      data: {
        email,
        googleSub: sub,
        verifiedEmail: email,
        registeredAt: new Date().toISOString(),
        registrationMethod: 'google',
        googleProfile: { name, picture },
        name: name || email.split('@')[0],
        password: plainSecret,
        oauthLoginSecretEnc: encryptedSecret,
      },
    })
    userId = newUser.id
    await logOAuthEvent('user_created', { correlationId, userId, googleSub: sub })
  } catch (error: unknown) {
    return await handleRaceCondition(payload, req, res, error, sub, correlationId)
  }

  // Issue session using the plain secret we just set
  try {
    const { token } = await issueSessionWithPlainSecret(email, plainSecret)
    res.headers.set('Location', new URL(returnTo, req.url).toString())
    setAuthCookie(res, payload, token)
    return res
  } catch (error) {
    logOAuthError('session_issuance_failed', error, correlationId)
    res.headers.set('Location', new URL('/login?error=session_issue_failed', req.url).toString())
    return res
  }
}

async function handleRaceCondition(
  payload: Payload,
  req: NextRequest,
  res: NextResponse,
  error: unknown,
  sub: string,
  correlationId: string,
): Promise<NextResponse> {
  const errorObj = error as { code?: number; name?: string; message?: string }
  const isDuplicateKey =
    errorObj?.code === 11000 ||
    errorObj?.name === 'MongoServerError' ||
    (errorObj?.message && errorObj.message.includes('E11000'))

  if (isDuplicateKey) {
    const retryUser = await payload.find({
      collection: 'users',
      where: { googleSub: { equals: sub } },
      limit: 1,
      overrideAccess: true,
    })

    if (retryUser.docs.length > 0) {
      const user = retryUser.docs[0]

      if (!user.oauthLoginSecretEnc) {
        logOAuthError(
          'race_recovery_missing_secret',
          'Race recovery failed: secret not set',
          correlationId,
        )
        res.headers.set('Location', new URL('/login?error=auth_error', req.url).toString())
        return res
      }

      await logOAuthEvent('user_created_race_recovery', {
        correlationId,
        userId: user.id,
        googleSub: sub,
      })
      return res
    }
  }

  logOAuthError('user_creation_failed', error, correlationId)
  throw error
}
