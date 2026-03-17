/**
 * Access code redemption endpoint
 *
 * POST /api/entitlements/redeem
 * Body: { code: string }
 * Returns: { success: boolean, error?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'

const redeemSchema = z.object({
  code: z.string().trim().min(1, 'code_required'),
})

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) {
    return NextResponse.json({ success: false, error: 'authentication_required' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 })
  }

  const parsed = redeemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'code_required' }, { status: 400 })
  }

  const code = parsed.data.code

  // Find the access code
  const accessCodes = await payload.find({
    collection: 'access-codes',
    where: {
      code: { equals: code },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (accessCodes.totalDocs === 0) {
    return NextResponse.json({ success: false, error: 'invalid_code' }, { status: 404 })
  }

  const accessCode = accessCodes.docs[0]

  // Validate the code is active
  if (!accessCode.isActive) {
    return NextResponse.json({ success: false, error: 'code_inactive' }, { status: 400 })
  }

  // Check expiration
  if (accessCode.expiresAt && new Date(accessCode.expiresAt) < new Date()) {
    return NextResponse.json({ success: false, error: 'code_expired' }, { status: 400 })
  }

  // Check usage limit
  const maxUses = accessCode.maxUses ?? 0
  const currentUses = accessCode.currentUses ?? 0
  if (maxUses > 0 && currentUses >= maxUses) {
    return NextResponse.json({ success: false, error: 'code_exhausted' }, { status: 400 })
  }

  const courseId = typeof accessCode.course === 'string' ? accessCode.course : accessCode.course.id

  // Get current user with entitlements
  const fullUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: true,
    select: { courseEntitlements: true },
  })

  const existing = fullUser.courseEntitlements || []

  // Check if user already has this course
  const alreadyHas = existing.some((e) => {
    const entCourseId = typeof e.course === 'string' ? e.course : e.course?.id
    return entCourseId === courseId
  })

  if (alreadyHas) {
    return NextResponse.json({ success: false, error: 'already_entitled' }, { status: 409 })
  }

  // Add entitlement to user's array
  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      courseEntitlements: [
        ...existing,
        {
          course: courseId,
          grantMethod: 'code' as const,
          grantedAt: new Date().toISOString(),
        },
      ],
    },
    overrideAccess: true,
  })

  // Increment usage count
  await payload.update({
    collection: 'access-codes',
    id: accessCode.id,
    data: {
      currentUses: currentUses + 1,
    },
    overrideAccess: true,
  })

  return NextResponse.json({ success: true })
}
