/**
 * Enrollment API — Get, Update, Cancel
 *
 * @fileType api-route
 * @domain lms
 * @pattern enrollment
 * @ai-summary Get a single enrollment, update its status (admin), or cancel it (student)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { AccountRole } from '@/server/payload/collections/Users/roles'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/enrollments/[id]
 * Get a single enrollment by ID.
 * Students can only access their own enrollments.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const enrollment = await payload.findByID({
    collection: 'enrollments',
    id,
    depth: 2,
    overrideAccess: true,
  })

  if (!enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const isAdmin =
    user.collection === 'users' && (user as { role?: AccountRole }).role === AccountRole.Admin
  const studentId =
    typeof enrollment.student === 'string' ? enrollment.student : enrollment.student?.id

  if (!isAdmin && studentId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ enrollment })
}

/**
 * PATCH /api/enrollments/[id]
 * Update an enrollment.
 * - Students can cancel their own pending enrollments.
 * - Admins can update any enrollment (approve, reject, set expiry, etc.).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin =
    user.collection === 'users' && (user as { role?: AccountRole }).role === AccountRole.Admin

  // Fetch current enrollment
  const existing = await payload.findByID({
    collection: 'enrollments',
    id,
    depth: 0,
    overrideAccess: true,
  })

  if (!existing) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const studentId =
    typeof existing.student === 'string'
      ? existing.student
      : (existing.student as { id: string } | undefined)?.id

  const canUpdate = isAdmin || (studentId === user.id && existing.status === 'pending')

  if (!canUpdate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { status, expiresAt, grantMethod, notes, requestReason } = body as {
    status?: string
    expiresAt?: string | null
    grantMethod?: string
    notes?: string
    requestReason?: string
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {}

  // Students can only set status=cancelled
  if (isAdmin) {
    if (status) updateData.status = status
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt
    if (grantMethod) updateData.grantMethod = grantMethod
    if (notes !== undefined) updateData.notes = notes
    if (requestReason !== undefined) updateData.requestReason = requestReason

    // Mark as processed when admin changes status
    if (status && status !== 'pending') {
      updateData.processedAt = new Date().toISOString()
      updateData.processedBy = user.id
    }
  } else {
    // Student cancellation
    if (status === 'cancelled') {
      updateData.status = 'cancelled'
    } else {
      return NextResponse.json(
        { error: 'Students can only cancel their pending enrollment' },
        { status: 400 },
      )
    }
  }

  const enrollment = await payload.update({
    collection: 'enrollments',
    id,
    data: updateData,
    overrideAccess: true,
  })

  return NextResponse.json({ enrollment })
}

/**
 * DELETE /api/enrollments/[id]
 * Admin-only deletion.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.collection !== 'users' || (user as { role?: AccountRole }).role !== AccountRole.Admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await payload.delete({
      collection: 'enrollments',
      id,
      overrideAccess: true,
    })
  } catch {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
