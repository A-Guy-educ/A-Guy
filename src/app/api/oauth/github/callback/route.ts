/**
 * GitHub OAuth Callback — Cody Dashboard
 *
 * @fileType api-route
 * @domain auth
 * @pattern oauth
 * @ai-summary Handles GitHub OAuth callback for the Cody Operations Dashboard.
 *   Exchanges code for access token, fetches user profile, verifies the user is
 *   a repo collaborator (using the bot token), then issues a signed JWT session
 *   cookie (cody-gh-session). Does NOT create Payload CMS users.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateOAuthState } from '@/infra/auth/oauth_state'
import { getPublicBaseUrl } from '@/infra/auth/oauth_url'
import { createCodySession } from '@/infra/auth/cody_session'
import { fetchCollaborators } from '@/ui/cody/github-client'
import { logger } from '@/infra/utils/logger/logger'

interface GitHubUserInfo {
  id: number
  login: string
  avatar_url: string
  name?: string
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = crypto.randomUUID()
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  // Use a mutable response for cookie operations
  const res = new NextResponse(null, { status: 302 })

  // STEP 1: CSRF Protection
  const { valid: stateValid, returnTo } = validateOAuthState(req, res, state)
  if (!stateValid) {
    logger.warn({ correlationId, event: 'github_oauth_invalid_state' }, 'Invalid OAuth state')
    res.headers.set('Location', new URL('/cody?error=invalid_state', req.url).toString())
    return res
  }

  if (!code) {
    res.headers.set('Location', new URL('/cody?error=missing_code', req.url).toString())
    return res
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    logger.error(
      { correlationId, event: 'github_oauth_not_configured' },
      'GitHub OAuth env vars missing',
    )
    res.headers.set('Location', new URL('/cody?error=not_configured', req.url).toString())
    return res
  }

  // STEP 2: Exchange code for access token
  const baseUrl = getPublicBaseUrl(req)
  const callbackUrl = `${baseUrl}/api/oauth/github/callback`

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl,
    }),
  })

  if (!tokenResponse.ok) {
    logger.error(
      { correlationId, event: 'github_oauth_token_exchange_failed' },
      'Token exchange failed',
    )
    res.headers.set('Location', new URL('/cody?error=token_exchange_failed', req.url).toString())
    return res
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string }
  if (!tokenData.access_token || tokenData.error) {
    logger.warn(
      { correlationId, event: 'github_oauth_no_token', error: tokenData.error },
      'No access token in response',
    )
    res.headers.set('Location', new URL('/cody?error=token_exchange_failed', req.url).toString())
    return res
  }

  // STEP 3: Fetch GitHub user profile
  const userinfoResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!userinfoResponse.ok) {
    logger.error(
      { correlationId, event: 'github_oauth_userinfo_failed' },
      'User info request failed',
    )
    res.headers.set('Location', new URL('/cody?error=userinfo_failed', req.url).toString())
    return res
  }

  const userinfo = (await userinfoResponse.json()) as GitHubUserInfo
  if (!userinfo.id || !userinfo.login) {
    res.headers.set('Location', new URL('/cody?error=invalid_userinfo', req.url).toString())
    return res
  }

  // STEP 4: Verify user is a repo collaborator (using bot token)
  try {
    const collaborators = await fetchCollaborators()
    const isCollaborator = collaborators.some(
      (c) => c.login.toLowerCase() === userinfo.login.toLowerCase(),
    )

    if (!isCollaborator) {
      logger.warn(
        { correlationId, event: 'github_oauth_not_collaborator', login: userinfo.login },
        'GitHub user is not a repo collaborator',
      )
      res.headers.set('Location', new URL('/cody?error=not_collaborator', req.url).toString())
      return res
    }
  } catch (err) {
    logger.error(
      { correlationId, event: 'github_oauth_collaborator_check_failed', err },
      'Collaborator check failed',
    )
    res.headers.set(
      'Location',
      new URL('/cody?error=collaborator_check_failed', req.url).toString(),
    )
    return res
  }

  // STEP 5: Issue session cookie
  await createCodySession(res, {
    login: userinfo.login,
    avatar_url: userinfo.avatar_url,
    githubId: userinfo.id,
  })

  logger.info(
    { correlationId, event: 'github_oauth_success', login: userinfo.login },
    'GitHub OAuth login successful',
  )

  res.headers.set('Location', returnTo || '/cody')
  return res
}
