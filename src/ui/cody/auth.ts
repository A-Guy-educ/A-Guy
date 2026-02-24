/**
 * @fileType utility
 * @domain cody
 * @pattern auth
 * @ai-summary Dashboard authentication middleware using Payload
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Require dashboard authentication using Payload
 * Returns the authenticated user or null if not authenticated
 */
export async function requireDashboardAuth(
  req: NextRequest,
): Promise<{ authenticated: boolean; user?: { id: string; email: string } }> {
  try {
    const payload = await getPayload({ config })

    // Get user from Payload auth
    const { user } = await payload.auth({ headers: req.headers })

    if (user && typeof user === 'object' && 'email' in user) {
      return {
        authenticated: true,
        user: { id: user.id as string, email: user.email as string },
      }
    }

    return { authenticated: false }
  } catch (error) {
    console.error('[Cody] Auth error:', error)
    return { authenticated: false }
  }
}

/**
 * Require auth or return 401
 */
export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const auth = await requireDashboardAuth(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
