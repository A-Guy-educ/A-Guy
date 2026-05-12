/**
 * User Subscription Management API
 *
 * @fileType api-route
 * @domain payments
 * @ai-summary Admin view/manage user subscriptions
 */

import { getPayload } from 'payload'

import config from '@payload-config'
import { revokeEntitlementsOnCancellation } from '@/server/services/payment/grants'

import type { Subscription, User } from '@/payload-types'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const payload = await getPayload({ config })

  // Auth check
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (
    !('collection' in authResult.user) ||
    authResult.user.collection !== 'users' ||
    authResult.user.role !== 'admin'
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await params

  try {
    // Fetch user subscriptions
    const subscriptions = await payload.find({
      collection: 'subscriptions',
      where: { user: { equals: userId } },
      limit: 100,
      depth: 2,
      overrideAccess: true,
    })

    // Fetch user's transaction history
    const transactions = await payload.find({
      collection: 'transactions',
      where: { user: { equals: userId } },
      limit: 100,
      depth: 2,
      overrideAccess: true,
    })

    // Fetch user info
    const user = (await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
      select: {
        name: true,
        email: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    })) as User | null

    return Response.json({
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            subscriptionStatus: user.subscriptionStatus,
            currentPeriodEnd: user.currentPeriodEnd,
            cancelAtPeriodEnd: user.cancelAtPeriodEnd,
          }
        : null,
      subscriptions: subscriptions.docs,
      transactions: transactions.docs,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    payload.logger.error({ error: errorMsg }, '[subscription-management] GET error')
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const payload = await getPayload({ config })

  // Auth check
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (
    !('collection' in authResult.user) ||
    authResult.user.collection !== 'users' ||
    authResult.user.role !== 'admin'
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await params

  try {
    const body = await req.json()
    const { action, days } = body as { action: 'cancel' | 'extend'; days?: number }

    if (!action) {
      return Response.json({ error: 'action is required' }, { status: 400 })
    }

    if (action === 'cancel') {
      // Find active subscription
      const activeSubscriptions = await payload.find({
        collection: 'subscriptions',
        where: {
          and: [{ user: { equals: userId } }, { status: { equals: 'active' } }],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (activeSubscriptions.totalDocs > 0) {
        const subscription = activeSubscriptions.docs[0] as Subscription

        await payload.update({
          collection: 'subscriptions',
          id: subscription.id,
          data: {
            cancelAtPeriodEnd: true,
          },
          overrideAccess: true,
        })
      }

      await revokeEntitlementsOnCancellation({
        payload,
        userId,
      })

      payload.logger.info({ userId }, '[subscription-management] Subscription cancelled')

      return Response.json({
        success: true,
        message: 'Subscription cancelled at period end',
      })
    } else if (action === 'extend') {
      if (!days || days <= 0) {
        return Response.json({ error: 'days must be a positive number' }, { status: 400 })
      }

      // Find active subscription
      const activeSubscriptions = await payload.find({
        collection: 'subscriptions',
        where: {
          and: [{ user: { equals: userId } }, { status: { equals: 'active' } }],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (activeSubscriptions.totalDocs === 0) {
        return Response.json({ error: 'No active subscription found' }, { status: 404 })
      }

      const subscription = activeSubscriptions.docs[0] as Subscription

      // Extend period
      const currentEnd = new Date(subscription.currentPeriodEnd)
      currentEnd.setDate(currentEnd.getDate() + days)

      await payload.update({
        collection: 'subscriptions',
        id: subscription.id,
        data: {
          currentPeriodEnd: currentEnd.toISOString(),
        },
        overrideAccess: true,
      })

      await payload.update({
        collection: 'users',
        id: userId,
        data: {
          currentPeriodEnd: currentEnd.toISOString(),
        },
        overrideAccess: true,
      })

      payload.logger.info({ userId, days }, '[subscription-management] Subscription extended')

      return Response.json({
        success: true,
        message: `Subscription extended by ${days} days`,
        newPeriodEnd: currentEnd.toISOString(),
      })
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    payload.logger.error({ error: errorMsg }, '[subscription-management] POST error')
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
