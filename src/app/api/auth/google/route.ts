import { NextRequest, NextResponse } from 'next/server'
import { generateCodeVerifier } from 'arctic'

import { createGoogleOAuth } from '@/lib/auth/google-oauth'
import { createOAuthState } from '@/lib/auth/oauth-state'
import { setOAuthCookies } from '@/lib/auth/oauth-cookies'

function sanitizeReturnTo(value?: string | null) {
  if (!value) return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return value
}

export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'))
  const mode = request.nextUrl.searchParams.get('mode') === 'link' ? 'link' : 'login'

  const google = createGoogleOAuth()
  const state = createOAuthState()
  const codeVerifier = generateCodeVerifier()

  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile'])
  const response = NextResponse.redirect(url)

  setOAuthCookies(response, { state, returnTo, mode, codeVerifier })

  return response
}
