/**
 * Stripe Webhook Handler
 *
 * POST /api/webhooks/stripe
 *
 * Verifies Stripe webhook signature, updates Transaction status, and grants
 * entitlements on successful payment. Returns 400 for bad signatures (no retry),
 * 500 for transient errors (provider will retry), and 200 for downstream
 * processing errors that should not be retried.
 *
 * @fileType api-route
 * @domain payments
 * @pattern webhook
 * @ai-summary Handles Stripe webhook events for payment confirmation and refunds
 */

import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import Stripe from 'stripe'

import { getPayload } from 'payload'
import config from '@payload-config'

import { grantProductEntitlements } from '@/lib/payment/grant-entitlements'
import { verifyStripeWebhook } from '@/lib/payment/stripe'

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })

  // 1. Extract raw body as Buffer for signature verification
  const arrayBuffer = await request.arrayBuffer()
  const rawBody = Buffer.from(arrayBuffer)

  // 2. Extract signature header
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    payload.logger.error('Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature header' }, { status: 400 })
  }

  // 3. Verify webhook signature
  let event: Stripe.Event
  try {
    event = await verifyStripeWebhook(rawBody, signature)
  } catch (err) {
    const sourceIp =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const bodySnippet = rawBody.toString('utf8').slice(0, 100)

    const isSignatureError =
      err instanceof Stripe.errors.StripeSignatureVerificationError ||
      (err instanceof Stripe.errors.StripeError && err.type === 'StripeSignatureVerificationError')

    if (isSignatureError) {
      payload.logger.warn(
        { error: err, sourceIp, bodySnippet },
        'Stripe webhook signature verification failed — returning 400',
      )
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Transient error (network issue, missing config, etc.) — provider should retry
    payload.logger.error(
      { error: err, sourceIp, bodySnippet },
      'Stripe webhook signature verification threw transient error — returning 500',
    )
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }

  // 4. Route event by type
  try {
    await handleEvent(payload, event)
  } catch (err) {
    payload.logger.error({ error: err, eventType: event.type }, 'Stripe webhook handler error')
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true }, { status: 200 })
}

/**
 * Consumes a coupon atomically on successful payment.
 *
 * Uses MongoDB atomic $inc with a conditional filter to prevent race conditions
 * when multiple concurrent checkouts compete for the same limited-use coupon.
 *
 * The coupon-usages row is created only if the atomic increment succeeds,
 * and the afterChange hook is skipped via context to avoid double-incrementing.
 *
 * @param payload - Payload instance
 * @param transaction - The succeeded transaction with appliedCoupon in metadata
 */
async function consumeCouponOnPayment(
  payload: Awaited<ReturnType<typeof getPayload>>,
  transaction: {
    id: string
    metadata?: {
      appliedCoupon?: {
        code: string
        discountType: string
        discountValue: number
        originalAmount?: number
        discountedAmount?: number
      }
    } | null
    user?: string | { id: string }
    product?: string | { id: string }
  },
): Promise<void> {
  const appliedCoupon = transaction.metadata?.appliedCoupon
  if (!appliedCoupon) return

  // Find the coupon by code
  const coupons = await payload.find({
    collection: 'coupons',
    where: { code: { equals: appliedCoupon.code } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (coupons.totalDocs === 0) {
    payload.logger.warn({ code: appliedCoupon.code }, 'Coupon not found for consumption')
    return
  }

  const coupon = coupons.docs[0] as {
    id: string
    maxUses?: number
    usesCount?: number
    tenant?: string | { id: string } | null
  }

  const userId = typeof transaction.user === 'object' ? transaction.user.id : transaction.user

  // Atomic increment: use $inc with $expr filter to check usesCount < maxUses
  // This prevents race conditions where two concurrent payments could both pass the check
  const couponsCollection = payload.db.collections['coupons']
  const filter: Record<string, unknown> = { _id: new ObjectId(coupon.id) }

  // Only add maxUses filter if maxUses > 0 (0 means unlimited)
  if ((coupon.maxUses ?? 0) > 0) {
    filter.$expr = { $lt: ['$usesCount', '$maxUses'] }
  }

  const result = await couponsCollection.updateOne(filter, { $inc: { usesCount: 1 } })

  if (result.modifiedCount === 0) {
    // Coupon is exhausted (usesCount >= maxUses or doesn't exist)
    payload.logger.warn(
      { couponId: coupon.id, code: appliedCoupon.code },
      'Coupon exhausted — payment succeeded but coupon not consumed',
    )
    return
  }

  // Create coupon-usages row (skip the afterChange hook since we did the increment manually)
  await payload.create({
    collection: 'coupon-usages',
    data: {
      coupon: coupon.id,
      transaction: transaction.id,
      user: userId,
      tenant: coupon.tenant ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    context: { skipUsesCountHook: true },
    overrideAccess: true,
  })

  payload.logger.info(
    { couponId: coupon.id, code: appliedCoupon.code, transactionId: transaction.id },
    'Coupon consumed atomically on payment success',
  )
}

async function handleEvent(
  payload: Awaited<ReturnType<typeof getPayload>>,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const sessionId = event.data.object.id

      // Find the transaction by providerTransactionId (Stripe session ID)
      const transactions = await payload.find({
        collection: 'transactions',
        where: {
          providerTransactionId: { equals: sessionId },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (transactions.totalDocs === 0) {
        payload.logger.warn({ sessionId }, 'Stripe webhook: transaction not found')
        return
      }

      const transaction = transactions.docs[0]

      // Idempotency: skip if entitlements already granted (replayed webhook)
      if (transaction.entitlementsGrantedAt) {
        return
      }

      // Grant entitlements BEFORE flipping status to succeeded — fail-safe:
      // if grant throws we do NOT set status=succeeded so the provider retries.
      await grantProductEntitlements(
        transaction.user as string,
        transaction.product as string,
        transaction.id,
      )

      // Grant succeeded — atomically flip status and record the grant timestamp
      await payload.update({
        collection: 'transactions',
        id: transaction.id,
        data: { status: 'succeeded', entitlementsGrantedAt: new Date().toISOString() },
        overrideAccess: true,
      })

      // Consume coupon atomically (if applied)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await consumeCouponOnPayment(payload, transaction as any)
      } catch (err) {
        payload.logger.error(
          { error: err, transactionId: transaction.id },
          'Failed to consume coupon',
        )
      }
      break
    }

    case 'checkout.session.expired': {
      const sessionId = event.data.object.id

      const transactions = await payload.find({
        collection: 'transactions',
        where: {
          providerTransactionId: { equals: sessionId },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (transactions.totalDocs === 0) {
        payload.logger.warn(
          { sessionId },
          'Stripe webhook: transaction not found for session.expired',
        )
        return
      }

      await payload.update({
        collection: 'transactions',
        id: transactions.docs[0].id,
        data: { status: 'failed' },
        overrideAccess: true,
      })
      break
    }

    case 'charge.refunded': {
      const paymentIntentId = event.data.object.payment_intent as string

      const transactions = await payload.find({
        collection: 'transactions',
        where: {
          providerTransactionId: { equals: paymentIntentId },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (transactions.totalDocs === 0) {
        payload.logger.warn(
          { paymentIntentId },
          'Stripe webhook: transaction not found for charge.refunded',
        )
        return
      }

      await payload.update({
        collection: 'transactions',
        id: transactions.docs[0].id,
        data: { status: 'refunded' },
        overrideAccess: true,
      })
      break
    }

    default:
      // Unhandled event type — acknowledge without processing
      break
  }
}
