/**
 * @fileType api-route
 * @domain cody
 * @pattern auth-api
 * @ai-summary Returns the current GitHub identity from the Cody session cookie.
 *   Used by useGitHubIdentity hook to hydrate the identity on page load.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCodySession } from '@/infra/auth/cody_session'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const identity = await verifyCodySession(req)

  if (!identity) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      login: identity.login,
      avatar_url: identity.avatar_url,
      githubId: identity.githubId,
    },
  })
}
