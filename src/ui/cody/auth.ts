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
