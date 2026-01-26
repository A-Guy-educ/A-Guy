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
import {
  issueSession,
  issueSessionWithPlainSecret,
  issueSessionForLinkedAccount,
} from '@/infra/auth/oauth_session'
import { setAuthCookie } from '@/infra/auth/oauth_cookies'
import { logOAuthEvent, logOAuthError } from '@/infra/auth/oauth_logger'
import { generateSecret, encrypt } from '@/infra/auth/oauth_crypto'

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
  // Update profile only (name from Google)
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { googleProfile: { name: profile.name } },
  })

  await logOAuthEvent('user_updated', { correlationId, userId: user.id, googleSub: sub })

  // Check if this is a linked account (has googleSub but no oauthLoginSecretEnc)
  // or a pure OAuth account (has both)
  const isLinkedAccount = !user.oauthLoginSecretEnc

  try {
    let token: string

    if (isLinkedAccount) {
      // Linked account: user kept their email/password, generate token directly
      const result = await issueSessionForLinkedAccount(user.id)
      token = result.token
    } else {
      // Pure OAuth account: use stored encrypted secret
      // CRITICAL: Use user.email (from DB), NOT userinfo.email (Google may change)
      const result = await issueSession(user.email, user.oauthLoginSecretEnc!)
      token = result.token
    }

    const redirectUrl = new URL(returnTo, req.url).toString()
    res.headers.set('Location', redirectUrl)
    setAuthCookie(res, payload, token)
    return res
  } catch (error) {
    logOAuthError('session_issuance_failed', error, correlationId)
    res.headers.set('Location', new URL('/login?error=session_issue_failed', req.url).toString())
    return res
  }
}

export async function handleCollision(
  payload: Payload,
  req: NextRequest,
  res: NextResponse,
  existingUser: User,
  sub: string,
  correlationId: string,
  email: string,
  profile: { name?: string; picture?: string },
  returnTo: string,
): Promise<NextResponse> {
  // Check if googleSub is missing or empty (account needs linking)
  const googleSubMissing =
    existingUser.googleSub === null ||
    existingUser.googleSub === undefined ||
    existingUser.googleSub === ''

  // If googleSub already exists and matches, this shouldn't happen (should be caught by first lookup)
  if (!googleSubMissing && existingUser.googleSub === sub) {
    logOAuthError(
      'unexpected_collision_path',
      'User with googleSub reached collision handler',
      correlationId,
    )
    res.headers.set('Location', new URL('/login?error=auth_error', req.url).toString())
    return res
  }

  // If googleSub exists but doesn't match, this is a real collision - different Google account
  if (!googleSubMissing && existingUser.googleSub !== sub) {
    await logOAuthEvent('collision_different_google', {
      correlationId,
      email,
      googleSub: sub,
      existingGoogleSub: existingUser.googleSub,
    })
    res.headers.set(
      'Location',
      new URL('/login?error=account_exists_different_google', req.url).toString(),
    )
    return res
  }

  // Link the Google account to the existing email/password user
  try {
    // Update user with Google OAuth fields
    // NOTE: We do NOT update password or oauthLoginSecretEnc
    // This allows the user to keep both login methods:
    // - Email/password login continues to work with their existing password
    // - Google login works by verifying googleSub and generating token directly

    // CRITICAL: Use MongoDB direct update to avoid Payload hooks that might clear password
    const db = payload.db
    const { ObjectId } = await import('mongodb')
    await db.collections.users.updateOne(
      { _id: new ObjectId(existingUser.id) },
      {
        $set: {
          googleSub: sub,
          googleProfile: { name: profile.name },
          verifiedEmail: email,
        },
      },
    )

    await logOAuthEvent('account_linked', {
      correlationId,
      userId: existingUser.id,
      googleSub: sub,
      previousRegistrationMethod: existingUser.registrationMethod,
    })

    // Issue session directly (without password check) for linked accounts
    const { token } = await issueSessionForLinkedAccount(existingUser.id)
    res.headers.set('Location', new URL(returnTo, req.url).toString())
    setAuthCookie(res, payload, token)
    return res
  } catch (error) {
    logOAuthError('account_linking_failed', error, correlationId)
    res.headers.set('Location', new URL('/login?error=linking_failed', req.url).toString())
    return res
  }
}

export async function createNewOAuthUser(
  payload: Payload,
  req: NextRequest,
  res: NextResponse,
  userinfo: { sub: string; email: string; name?: string; picture?: string },
  returnTo: string,
  correlationId: string,
): Promise<NextResponse> {
  const { sub, email, name } = userinfo
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
        googleProfile: { name },
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
