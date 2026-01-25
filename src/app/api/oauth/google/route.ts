/**
 * Google OAuth Authorization Redirect
 *
 * @fileType api-route
 * @domain auth
 * @pattern oauth
 * @ai-summary Initiates Google OAuth flow by redirecting to Google consent screen
 */

import { getGoogleOAuthSecrets } from '@/infra/auth/oauth-secrets'
import { sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'
import { storeOAuthState } from '@/infra/auth/oauth_state'
import { getPublicBaseUrl } from '@/infra/auth/oauth_url'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get('returnTo'))

  const baseUrl = getPublicBaseUrl(req)
  const callbackUrl = `${baseUrl}/api/oauth/google/callback`

  // Get Google OAuth credentials from tenant-scoped config
  const payload = await getPayload({ config })
  const { clientId } = await getGoogleOAuthSecrets(payload)

  const authUrl = new URL(GOOGLE_AUTH_URL)
  authUrl.searchParams.set('client_id', clientId)
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
