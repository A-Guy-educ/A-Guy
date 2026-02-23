/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern auth-api
 * @ai-summary API route for dashboard auth status
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireDashboardAuth } from '@/ui/cody/auth'

export async function GET(req: NextRequest) {
  // Check if already authenticated via Payload
  const auth = await requireDashboardAuth(req)
  return NextResponse.json({ authenticated: auth.authenticated })
}
