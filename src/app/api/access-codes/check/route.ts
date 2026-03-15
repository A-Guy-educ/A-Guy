/**
 * Access Code Check API
 *
 * GET /api/access-codes/check?lessonId=abc123
 * Checks if the current user has already redeemed a code for a lesson
 */

import { getPayload } from 'payload'

import config from '@payload-config'

export async function GET(req: Request) {
  try {
    const payload = await getPayload({ config })

    // 1. Authenticate user
    const authResult = await payload.auth({ headers: req.headers })
    if (!authResult.user) {
      return Response.json({ redeemed: false }, { status: 401 })
    }

    const userId = authResult.user.id

    // 2. Get lessonId from query params
    const url = new URL(req.url)
    const lessonId = url.searchParams.get('lessonId')

    if (!lessonId) {
      return Response.json({ error: 'lessonId required' }, { status: 400 })
    }

    // 3. Check if there's a redemption record for this user and lesson
     
    const redemption = await payload.find({
      collection: 'code-redemptions' as any,
      where: {
        and: [{ user: { equals: userId } }, { lessonId: { equals: lessonId } }],
      },
      limit: 1,
      overrideAccess: true,
    })

    return Response.json({ redeemed: redemption.docs.length > 0 })
  } catch (error) {
    console.error('Error checking access code redemption:', error)
    return Response.json({ redeemed: false }, { status: 500 })
  }
}
