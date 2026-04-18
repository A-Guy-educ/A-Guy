/**
 * Enrollments API — List & Create
 *
 * @fileType api-route
 * @domain lms
 * @pattern enrollment
 * @ai-summary Lists enrollments for the authenticated user or all (admin), and creates new enrollment requests
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'

import config from '@payload-config'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { getDefaultTenantId } from '@/server/services/tenant'

/**
 * GET /api/enrollments
 * List enrollments for the authenticated user.
 * Admins can list all by passing ?all=true.
 */
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const listAll = searchParams.get('all') === 'true'
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

  // Admins can list all enrollments
  const isAdmin = user.role === AccountRole.Admin

  if (listAll && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const where: Where | undefined = listAll
    ? undefined
    : { student: { equals: user.id } }

  const result = await payload.find({
    collection: 'enrollments',
    where,
    page,
    limit,
    sort: '-createdAt',
    depth: 2,
    overrideAccess: true,
  })

  return NextResponse.json({
    enrollments: result.docs,
    totalPages: result.totalPages,
    totalDocs: result.totalDocs,
    page,
    limit,
  })
}

/**
 * POST /api/enrollments
 * Create a new enrollment request (student self-request or admin direct create).
 * Students can only create 'pending' requests.
 * Admins can create enrollments directly with any status (e.g., 'approved').
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = user.role === AccountRole.Admin

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { courseId, requestReason, status, expiresAt, grantMethod, notes } = body as {
    courseId?: string
    requestReason?: string
    status?: string
    expiresAt?: string
    grantMethod?: string
    notes?: string
  }

  if (!courseId) {
    return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
  }

  // Students can only create pending requests
  const finalStatus = isAdmin ? (status ?? 'approved') : 'pending'

  // Check for existing pending/approved enrollment for this course
  const existing = await payload.find({
    collection: 'enrollments',
    where: {
      and: [
        { student: { equals: user.id } },
        { course: { equals: courseId } },
        { status: { in: ['pending', 'approved'] as const } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.totalDocs > 0) {
    return NextResponse.json(
      { error: 'An active enrollment already exists for this course' },
      { status: 409 },
    )
  }

  // Get default tenant (required by collection schema)
  const tenantId = await getDefaultTenantId(payload)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrollmentData: Record<string, any> = {
    tenant: tenantId,
    student: user.id,
    course: courseId,
    status: finalStatus,
    requestedAt: new Date().toISOString(),
    requestReason: requestReason ?? '',
    grantMethod: grantMethod ?? (isAdmin ? 'admin' : 'request'),
  }

  if (isAdmin) {
    if (expiresAt) enrollmentData.expiresAt = expiresAt
    if (notes !== undefined) enrollmentData.notes = notes
    enrollmentData.processedAt = new Date().toISOString()
    enrollmentData.processedBy = user.id
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrollment = await payload.create({
    collection: 'enrollments',
    data: enrollmentData,
    draft: false,
    overrideAccess: true,
  } as any)

  return NextResponse.json({ enrollment }, { status: 201 })
}
