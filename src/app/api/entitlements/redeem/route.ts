/**
 * Access code redemption endpoint
 *
 * POST /api/entitlements/redeem
 * Body: { code: string }
 * Returns: { success: boolean, error?: string }
 *
 * @fileType api-route
 * @domain entitlements
 * @pattern atomic-update
 * @ai-summary Redeems access codes using atomic MongoDB operations to prevent TOCTOU race conditions
 */

import { ObjectId } from 'mongodb'
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

  // Find the access code (non-atomic read for early validation and to get maxUses/courseId)
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

  // Early validation (also enforced atomically in step 1 below)
  if (!accessCode.isActive) {
    return NextResponse.json({ success: false, error: 'code_inactive' }, { status: 400 })
  }
  if (accessCode.expiresAt && new Date(accessCode.expiresAt) < new Date()) {
    return NextResponse.json({ success: false, error: 'code_expired' }, { status: 400 })
  }

  const maxUses = accessCode.maxUses ?? 0
  const courseId = typeof accessCode.course === 'string' ? accessCode.course : accessCode.course.id

  const accessCodesCollection = payload.db.collections['access-codes']
  const usersCollection = payload.db.collections.users

  try {
    // --- Atomic Step 1: Increment access code usage ---
    // Uses updateOne with conditions to atomically check-and-increment.
    // Includes isActive and expiresAt in the filter to prevent races with admin deactivation.
    const incrementFilter: Record<string, unknown> = {
      _id: new ObjectId(accessCode.id),
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    }
    if (maxUses > 0) {
      incrementFilter.currentUses = { $lt: maxUses }
    }

    const incrementResult = await accessCodesCollection.updateOne(incrementFilter, {
      $inc: { currentUses: 1 },
    })

    if (incrementResult.modifiedCount === 0) {
      // The atomic filter includes isActive, expiresAt, and currentUses < maxUses.
      // We cannot distinguish which condition caused the failure without a non-atomic re-read,
      // so we return a generic error. The early validation above already handles the obvious
      // inactive/expired cases; reaching here most likely means the code was exhausted or
      // an admin changed the code state concurrently.
      return NextResponse.json({ success: false, error: 'code_unavailable' }, { status: 409 })
    }

    // --- Atomic Step 2: Add entitlement only if user doesn't already have it ---
    // Uses updateOne with a $ne filter on courseEntitlements.course combined with $push.
    // If the user already has this course, modifiedCount will be 0.
    const courseObjectId = new ObjectId(courseId)

    let entitlementResult
    try {
      entitlementResult = await usersCollection.updateOne(
        {
          _id: new ObjectId(user.id),
          'courseEntitlements.course': { $ne: courseObjectId },
        },
        {
          $push: {
            courseEntitlements: {
              _id: new ObjectId(),
              course: courseObjectId,
              grantMethod: 'code',
              grantedAt: new Date().toISOString(),
            },
          },
        },
      )
    } catch (entitlementError) {
      // Step 2 threw — roll back step 1
      await rollBackIncrement(accessCodesCollection, accessCode.id, payload, user.id, courseId)
      throw entitlementError
    }

    if (entitlementResult.modifiedCount === 0) {
      // User already had this course entitlement — roll back the access code increment
      await rollBackIncrement(accessCodesCollection, accessCode.id, payload, user.id, courseId)
      return NextResponse.json({ success: false, error: 'already_entitled' }, { status: 409 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    payload.logger.error(
      { error, accessCodeId: accessCode.id, userId: user.id, courseId },
      'Access code redemption failed',
    )
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}

/** Roll back an access code increment, guarding against going below zero. */
async function rollBackIncrement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- direct MongoDB collection access
  collection: any,
  accessCodeId: string,
  payload: Awaited<ReturnType<typeof getPayload>>,
  userId: string,
  courseId: string,
): Promise<void> {
  try {
    await collection.updateOne(
      { _id: new ObjectId(accessCodeId), currentUses: { $gt: 0 } },
      { $inc: { currentUses: -1 } },
    )
  } catch (rollbackError) {
    payload.logger.error(
      { accessCodeId, userId, courseId, error: rollbackError },
      'Failed to roll back access code increment after duplicate entitlement detection',
    )
  }
}
