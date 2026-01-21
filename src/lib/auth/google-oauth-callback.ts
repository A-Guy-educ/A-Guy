import crypto from 'crypto'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { createGoogleOAuth, getGoogleUserInfo } from './google-oauth'
import { verifyOAuthState } from './oauth-state'
import { CODE_VERIFIER_COOKIE, cleanupOAuthCookies } from './oauth-cookies'
import { buildRedirect, sanitizeReturnTo } from './google-oauth-redirect'
import { handleGoogleLinkMode } from './google-oauth-link'
import { handleGoogleLoginMode } from './google-oauth-login'
import { createRequestLogger } from '@/utilities/logger'

export async function handleGoogleOAuthCallback(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  const reqLogger = createRequestLogger(requestId)
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    reqLogger.warn({ error }, 'Google OAuth error response')
    const response = buildRedirect(request, '/signup?error=oauth_failed')
    cleanupOAuthCookies(response)
    return response
  }

  if (!code || !state) {
    const response = buildRedirect(request, '/signup?error=invalid_request')
    cleanupOAuthCookies(response)
    return response
  }

  const { valid, returnTo, mode } = await verifyOAuthState(state)
  if (!valid) {
    const response = buildRedirect(request, '/signup?error=invalid_state')
    cleanupOAuthCookies(response)
    return response
  }

  const cookieStore = await cookies()
  const codeVerifier = cookieStore.get(CODE_VERIFIER_COOKIE)?.value

  if (!codeVerifier) {
    const response = buildRedirect(request, '/signup?error=invalid_request')
    cleanupOAuthCookies(response)
    return response
  }

  try {
    const google = createGoogleOAuth()
    const tokens = await google.validateAuthorizationCode(code, codeVerifier)
    const googleUser = await getGoogleUserInfo(tokens.accessToken())

    if (!googleUser.email_verified) {
      const response = buildRedirect(request, '/signup?error=email_not_verified')
      cleanupOAuthCookies(response)
      return response
    }

    const payload = await getPayload({ config })
    const normalizedEmail = googleUser.email.toLowerCase().trim()
    const safeReturnTo = sanitizeReturnTo(returnTo)

    const response =
      mode === 'link'
        ? await handleGoogleLinkMode({
            request,
            payload,
            googleUser,
            normalizedEmail,
            safeReturnTo,
          })
        : await handleGoogleLoginMode({
            request,
            payload,
            googleUser,
            normalizedEmail,
            safeReturnTo,
          })

    cleanupOAuthCookies(response)
    return response
  } catch (error: unknown) {
    reqLogger.error({ err: error }, 'Google OAuth callback failed')
    const response = buildRedirect(request, '/signup?error=oauth_failed')
    cleanupOAuthCookies(response)
    return response
  }
}
