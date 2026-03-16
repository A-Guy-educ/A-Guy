/**
 * Entitlement check API endpoint
 *
 * GET /api/entitlements/check?courseId=X
 * Returns { hasAccess: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { hasEntitlement } from '@/server/services/entitlement_check'

export async function GET(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) {
    return NextResponse.json({ hasAccess: false }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const courseId = searchParams.get('courseId') ?? undefined

  if (!courseId) {
    return NextResponse.json({ error: 'courseId required' }, { status: 400 })
  }

  const hasAccess = await hasEntitlement({
    payload,
    userId: user.id,
    courseId,
  })

  return NextResponse.json({ hasAccess })
}
