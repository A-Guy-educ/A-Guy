/**
 * @fileType utility
 * @domain cody
 * @pattern auth
 * @ai-summary Dashboard authentication middleware.
 *   requireCodyAuth: GitHub OAuth session (any repo collaborator) — used for Cody API routes.
 *   requireDashboardAuth / requireAuth: Legacy Payload-based auth — kept for backward compat.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyCodySession } from '@/infra/auth/cody_session'
import type { CodyGitHubIdentity } from '@/infra/auth/cody_session'
import { logger } from '@/infra/utils/logger/logger'

/**
 * Require dashboard authentication using Payload
 * Returns the authenticated user or null if not authenticated
 */
export async function requireDashboardAuth(
  req: NextRequest,
): Promise<{ authenticated: boolean; user?: { id: string; email: string; role?: string } }> {
  try {
    const payload = await getPayload({ config })

    // Get user from Payload auth
    const { user } = await payload.auth({ headers: req.headers })

    if (user && typeof user === 'object' && 'email' in user) {
      return {
        authenticated: true,
        user: {
          id: user.id as string,
          email: user.email as string,
          role: (user.role as string) || undefined,
        },
      }
    }

    return { authenticated: false }
  } catch (error) {
    console.error('[Cody] Auth error:', error)
    return { authenticated: false }
  }
}

/**
 * Require admin role for dashboard access
 * Returns the authenticated admin user or null if not authorized
 */
export async function requireAdminAuth(
  req: NextRequest,
): Promise<{ authenticated: boolean; user?: { id: string; email: string; role?: string } }> {
  const auth = await requireDashboardAuth(req)

  if (!auth.authenticated || !auth.user) {
    return { authenticated: false }
  }

  // Check if user has admin role
  if (auth.user.role !== 'admin') {
    return { authenticated: false }
  }

  return auth
}

/**
 * Require admin auth or return 401/403
 */
export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const auth = await requireAdminAuth(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/**
 * Require GitHub OAuth session for Cody API routes.
 * Returns the verified GitHubIdentity, or a 401 NextResponse if not authenticated.
 * Use this instead of requireAuth for routes that should be accessible to any repo collaborator.
 */
export async function requireCodyAuth(
  req: NextRequest,
): Promise<{ identity: CodyGitHubIdentity } | NextResponse> {
  const identity = await verifyCodySession(req)
  if (!identity) {
    return NextResponse.json(
      { message: 'Not authenticated. Please log in to access the dashboard.' },
      { status: 401 },
    )
  }
  return { identity }
}

/**
 * Verify that the supplied actorLogin matches the authenticated session.
 * This prevents actorLogin spoofing where a user could impersonate another user in GitHub comments.
 *
 * @param req - The incoming request
 * @param suppliedLogin - The actorLogin supplied in the request body
 * @returns The verified identity if it matches, or a 403 NextResponse if mismatch
 */
export async function verifyActorLogin(
  req: NextRequest,
  suppliedLogin: string | undefined,
): Promise<{ identity: CodyGitHubIdentity } | NextResponse> {
  // First verify the user is authenticated
  const authResult = await requireCodyAuth(req)
  if ('status' in authResult) {
    // Return the 401 response
    return authResult
  }

  const { identity } = authResult

  // If no actorLogin was supplied, use the authenticated user's login
  if (!suppliedLogin) {
    return { identity }
  }

  // Verify the supplied actorLogin matches the authenticated user
  // Allow exact match OR prefixed match (e.g., "john" matches "johndoe" for convenience)
  const normalizedSupplied = suppliedLogin.toLowerCase()
  const normalizedIdentity = identity.login.toLowerCase()

  if (
    normalizedSupplied !== normalizedIdentity &&
    !normalizedIdentity.startsWith(normalizedSupplied + '-')
  ) {
    logger.warn(
      {
        suppliedLogin,
        authenticatedLogin: identity.login,
        path: req.nextUrl.pathname,
      },
      'ActorLogin mismatch - possible impersonation attempt',
    )
    return NextResponse.json(
      { message: 'Invalid actorLogin: does not match authenticated session' },
      { status: 403 },
    )
  }

  return { identity }
}
