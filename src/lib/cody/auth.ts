/**
 * @fileType utility
 * @domain cody
 * @pattern auth
 * @ai-summary Dashboard authentication middleware
 */
import { NextRequest, NextResponse } from 'next/server'

const DASHBOARD_SECRET = process.env.CODY_DASHBOARD_SECRET

/**
 * Require dashboard authentication
 * Returns the authenticated user or null if not authenticated
 */
export function requireDashboardAuth(req: NextRequest): { authenticated: boolean; user?: string } {
  if (!DASHBOARD_SECRET) {
    console.warn('[Cody] CODY_DASHBOARD_SECRET not configured')
    return { authenticated: false }
  }

  // Check for auth cookie
  const cookie = req.cookies.get('cody-session')
  if (cookie?.value === DASHBOARD_SECRET) {
    return { authenticated: true, user: 'dashboard-user' }
  }

  // Check for auth header (for API calls)
  const authHeader = req.headers.get('authorization')
  if (authHeader === `Bearer ${DASHBOARD_SECRET}`) {
    return { authenticated: true, user: 'dashboard-user' }
  }

  return { authenticated: false }
}

/**
 * Require auth or return 401
 */
export function requireAuth(req: NextRequest): NextResponse | null {
  const { authenticated } = requireDashboardAuth(req)
  if (!authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/**
 * Create auth response with cookie
 */
export function createAuthResponse(): NextResponse {
  if (!DASHBOARD_SECRET) {
    return NextResponse.json({ error: 'Dashboard not configured' }, { status: 500 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('cody-session', DASHBOARD_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
  })

  return response
}
