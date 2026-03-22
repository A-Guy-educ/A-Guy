/**
 * @fileType api-route
 * @domain cody
 * @pattern auth-api
 * @ai-summary Clears the Cody GitHub session cookie (logout).
 *   After clearing, redirect to GitHub OAuth to re-authenticate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { clearCodySession } from '@/infra/auth/cody_session'
import { getPublicBaseUrl } from '@/infra/auth/oauth_url'

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.json({ success: true })
  clearCodySession(res)
  return res
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const baseUrl = getPublicBaseUrl(req)
  const res = new NextResponse(null, { status: 302 })
  clearCodySession(res)
  res.headers.set('Location', `${baseUrl}/api/oauth/github?returnTo=/cody`)
  return res
}
