/**
 * Access Code Redemption API
 *
 * POST /api/access-codes/redeem
 * Validates and redeems an access code for a lesson
 */

import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'

const redeemSchema = z.object({
  code: z.string().min(1),
  lessonId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const payload = await getPayload({ config })

    // 1. Authenticate user
    const authResult = await payload.auth({ headers: req.headers })
    if (!authResult.user) {
      return Response.json({ success: false, error: 'unauthorized' }, { status: 401 })
    }

    const userId = authResult.user.id

    // 2. Parse and validate request body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ success: false, error: 'invalid_body' }, { status: 400 })
    }

    const validation = redeemSchema.safeParse(body)
    if (!validation.success) {
      return Response.json(
        { success: false, error: 'invalid_request', details: validation.error.flatten() },
        { status: 400 },
      )
    }

    const { code, lessonId } = validation.data

    // 3. Find the access code
    const accessCodesResult = await payload.find({
      collection: 'access-codes',
      where: {
        code: { equals: code },
        isActive: { equals: true },
      },
      limit: 1,
      overrideAccess: true,
    })

    if (accessCodesResult.docs.length === 0) {
      return Response.json({ success: false, error: 'invalid_code' }, { status: 404 })
    }

    const accessCode = accessCodesResult.docs[0]

    // 4. Check expiration
    if (accessCode.expiresAt) {
      const expiresAt = new Date(accessCode.expiresAt)
      if (expiresAt < new Date()) {
        return Response.json({ success: false, error: 'expired_code' }, { status: 410 })
      }
    }

    // 5. Check max redemptions
    const currentRedemptions = accessCode.currentRedemptions ?? 0
    if (accessCode.maxRedemptions !== null && accessCode.maxRedemptions !== undefined) {
      if (currentRedemptions >= accessCode.maxRedemptions) {
        return Response.json({ success: false, error: 'max_redemptions_reached' }, { status: 410 })
      }
    }

    // 6. Check scope - verify the lesson matches
    if (accessCode.scopeType === 'lesson') {
      const scopeTarget =
        typeof accessCode.scopeTarget === 'string'
          ? accessCode.scopeTarget
          : accessCode.scopeTarget?.id

      if (scopeTarget !== lessonId) {
        return Response.json({ success: false, error: 'invalid_scope' }, { status: 400 })
      }
    }

    // 7. Check if already redeemed (idempotent)
    const existingRedemption = await payload.find({
      collection: 'code-redemptions',
      where: {
        and: [
          { user: { equals: userId } },
          { code: { equals: accessCode.id } },
          { lessonId: { equals: lessonId } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existingRedemption.docs.length > 0) {
      // Already redeemed - idempotent response
      return Response.json(
        {
          success: true,
          alreadyRedeemed: true,
          lessonId,
        },
        { status: 200 },
      )
    }

    // 8. Increment currentRedemptions and create redemption record
     
    await payload.update({
      collection: 'access-codes' as any,
      id: accessCode.id,
      data: {
        currentRedemptions: (accessCode.currentRedemptions || 0) + 1,
      },
      overrideAccess: true,
    })

     
    await payload.create({
      collection: 'code-redemptions' as any,
      data: {
        code: accessCode.id,
        user: userId,
        lessonId,
        redeemedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })

    return Response.json(
      {
        success: true,
        lessonId,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error redeeming access code:', error)
    return Response.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}
