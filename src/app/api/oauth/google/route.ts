/**
 * Google OAuth Authorization Redirect
 *
 * @fileType api-route
 * @domain auth
 * @pattern oauth
 * @ai-summary Initiates Google OAuth flow by redirecting to Google consent screen
 */

import { NextRequest, NextResponse } from 'next/server'
import { storeOAuthState } from '@/infra/auth/oauth_state'
import { sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'
import { getPublicBaseUrl } from '@/infra/auth/oauth_url'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get('returnTo'))

  const baseUrl = getPublicBaseUrl(req)
  const callbackUrl = `${baseUrl}/api/oauth/google/callback`

  const authUrl = new URL(GOOGLE_AUTH_URL)
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  authUrl.searchParams.set('redirect_uri', callbackUrl)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set(
    'scope',
    'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
  )

  const res = NextResponse.redirect(authUrl)
  const state = await storeOAuthState(res, returnTo)

  authUrl.searchParams.set('state', state)
  res.headers.set('Location', authUrl.toString())

  return res
}
