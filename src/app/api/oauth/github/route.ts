/**
 * GitHub OAuth Authorization Redirect — Cody Dashboard
 *
 * @fileType api-route
 * @domain auth
 * @pattern oauth
 * @ai-summary Initiates GitHub OAuth flow for the Cody Operations Dashboard.
 *   Redirects to GitHub consent screen requesting repo scope for per-user
 *   GitHub API operations (issues, PRs, actions, contents).
 */

import { NextRequest, NextResponse } from 'next/server'
import { storeOAuthState } from '@/infra/auth/oauth_state'
import { sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'
import { getPublicBaseUrl } from '@/infra/auth/oauth_url'

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get('returnTo') ?? '/cody')

  const baseUrl = getPublicBaseUrl(req)
  const callbackUrl = `${baseUrl}/api/oauth/github/callback`

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'GitHub OAuth not configured' }, { status: 503 })
  }

  const authUrl = new URL(GITHUB_AUTH_URL)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', callbackUrl)
  // repo scope grants: issues, PRs, actions, contents — needed for per-user dashboard operations
  authUrl.searchParams.set('scope', 'repo')

  const res = NextResponse.redirect(authUrl)
  const state = await storeOAuthState(res, returnTo)

  authUrl.searchParams.set('state', state)
  res.headers.set('Location', authUrl.toString())

  return res
}
