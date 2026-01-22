/**
 * Google OAuth Callback Handler
 *
 * @fileType api-route
 * @domain auth
 * @pattern oauth
 * @ai-summary Handles Google OAuth callback, creates/updates users, issues sessions
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { validateOAuthState } from '@/lib/auth/oauth_state'
import { logOAuthError } from '@/lib/auth/oauth_logger'
import { getPublicBaseUrl } from '@/lib/auth/oauth_url'
import { handleExistingUser, handleCollision, createNewOAuthUser } from './oauth_callback_helpers'

interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const payload = await getPayload({ config })
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const correlationId = crypto.randomUUID()

  const res = NextResponse.redirect(new URL('/login', req.url))

  // STEP 1: CSRF Protection
  const { valid: stateValid, returnTo } = validateOAuthState(req, res, state)

  if (!stateValid) {
    res.headers.set('Location', new URL('/login?error=invalid_state', req.url).toString())
    return res
  }

  if (!code) {
    res.headers.set('Location', new URL('/login?error=missing_code', req.url).toString())
    return res
  }

  // STEP 2: Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${getPublicBaseUrl(req)}/api/oauth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenResponse.ok) {
    logOAuthError('token_exchange_failed', 'token exchange failed', correlationId)
    res.headers.set('Location', new URL('/login?error=token_exchange_failed', req.url).toString())
    return res
  }

  const tokenData = await tokenResponse.json()
  if (!tokenData.access_token) {
    res.headers.set('Location', new URL('/login?error=token_exchange_failed', req.url).toString())
    return res
  }

  // STEP 3: Fetch userinfo
  const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })

  if (!userinfoResponse.ok) {
    logOAuthError('userinfo_failed', 'userinfo request failed', correlationId)
    res.headers.set('Location', new URL('/login?error=userinfo_failed', req.url).toString())
    return res
  }

  const userinfo: GoogleUserInfo = await userinfoResponse.json()
  const { sub, email, email_verified, name, picture } = userinfo

  if (!sub || !email) {
    res.headers.set('Location', new URL('/login?error=invalid_userinfo', req.url).toString())
    return res
  }

  // STEP 4: Email Verification
  if (email_verified !== true) {
    res.headers.set('Location', new URL('/login?error=email_not_verified', req.url).toString())
    return res
  }

  // Continue in helper to stay under 150 lines
  return await handleUserLookupAndSession(
    payload,
    req,
    res,
    { sub, email, name, picture },
    returnTo,
    correlationId,
  )
}

async function handleUserLookupAndSession(
  payload: Payload,
  req: NextRequest,
  res: NextResponse,
  userinfo: { sub: string; email: string; name?: string; picture?: string },
  returnTo: string,
  correlationId: string,
): Promise<NextResponse> {
  const { sub, email, name, picture } = userinfo

  // STEP 5: Lookup Order (Critical)
  // D.1: Find by googleSub - MUST use overrideAccess to read oauthLoginSecretEnc
  const existingByGoogleSub = await payload.find({
    collection: 'users',
    where: { googleSub: { equals: sub } },
    limit: 1,
    overrideAccess: true,
  })

  if (existingByGoogleSub.docs.length > 0) {
    return await handleExistingUser(
      payload,
      req,
      res,
      existingByGoogleSub.docs[0],
      { name, picture },
      returnTo,
      correlationId,
      sub,
    )
  }

  // D.2: Find by email - COLLISION CHECK
  const existingByEmail = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })

  if (existingByEmail.docs.length > 0) {
    return handleCollision(req, res, existingByEmail.docs[0], sub, correlationId, email)
  }

  // D.3: Create new user
  return await createNewOAuthUser(payload, req, res, userinfo, returnTo, correlationId)
}
