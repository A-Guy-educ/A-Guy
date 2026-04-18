/**
 * Enrollment Request API
 *
 * @fileType api-route
 * @domain lms
 * @pattern enrollment
 * @ai-summary Students request enrollment in a course — simplified endpoint for the frontend
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { getDefaultTenantId } from '@/server/services/tenant'

import config from '@payload-config'

/**
 * POST /api/enrollments/request
 * Student requests enrollment in a course.
 * Creates a pending enrollment request (no entitlement granted until admin approves).
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { courseId, requestReason } = body as {
    courseId?: string
    requestReason?: string
  }

  if (!courseId) {
    return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
  }

  // Check if course exists
  const course = await payload.findByID({
    collection: 'courses',
    id: courseId,
    depth: 0,
    overrideAccess: true,
  })

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // Check for existing active enrollment (pending or approved)
  const existing = await payload.find({
    collection: 'enrollments',
    where: {
      and: [
        { student: { equals: user.id } },
        { course: { equals: courseId } },
        {
          status: { in: ['pending', 'approved'] },
        },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.totalDocs > 0) {
    const existingEnrollment = existing.docs[0]
    if ((existingEnrollment as { status?: string }).status === 'approved') {
      return NextResponse.json(
        { error: 'You are already enrolled in this course' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: 'You already have a pending enrollment request for this course' },
      { status: 409 },
    )
  }

  // Get default tenant (required by collection schema)
  const tenantId = await getDefaultTenantId(payload)

  // Create the enrollment request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrollment = await payload.create({
    collection: 'enrollments',
    data: {
      tenant: tenantId,
      student: user.id,
      course: courseId,
      status: 'pending',
      requestReason: requestReason ?? '',
      requestedAt: new Date().toISOString(),
      grantMethod: 'request',
    } as any,
    draft: false,
    overrideAccess: true,
  })

  return NextResponse.json({ enrollment }, { status: 201 })
}
