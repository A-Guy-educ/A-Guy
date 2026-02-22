/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern auth-api
 * @ai-summary API route for dashboard login
 */
import { NextRequest, NextResponse } from 'next/server'

import { createAuthResponse, requireDashboardAuth } from '@/lib/cody/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { secret } = body

    if (!secret) {
      return NextResponse.json({ error: 'Secret required' }, { status: 400 })
    }

    const expectedSecret = process.env.CODY_DASHBOARD_SECRET

    if (!expectedSecret) {
      return NextResponse.json({ error: 'Dashboard not configured' }, { status: 500 })
    }

    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    // Create auth response with cookie
    return createAuthResponse()
  } catch (error) {
    console.error('[Cody] Auth error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Check if already authenticated
  const { authenticated } = requireDashboardAuth(req)
  return NextResponse.json({ authenticated })
}
