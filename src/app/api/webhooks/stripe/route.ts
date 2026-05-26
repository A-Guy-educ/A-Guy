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

/**
 * Detects duplicate-key errors from MongoDB (code 11000) and Payload CMS
 * ValidationError (wraps MongoDB duplicate key as "Value must be unique").
 */
function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: number; message?: string; errors?: unknown[]; data?: unknown }
  if (e.code === 11000) return true
  if (/E11000|duplicate key/i.test(e.message ?? '')) return true
  // Payload CMS ValidationError: message contains "unique"
  if (/unique/i.test(e.message ?? '')) return true
  // Payload ValidationError stores errors in data.errors or directly in errors
  const errors = (e.data as { errors?: unknown[] })?.errors ?? e.errors
  if (Array.isArray(errors)) {
    return errors.some(
      (err2: unknown) =>
        typeof err2 === 'object' &&
        err2 !== null &&
        /unique/i.test((err2 as { message?: string }).message ?? ''),
    )
  }
  return false
}

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
    event = await verifyStripeWebhook(rawBody, signature, 300)
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

  // 4. Dedup gate — attempt to create WebhookEvents doc.
  // On duplicate-key error the event was already received → return 200 immediately.
  let webhookEventId: string | null = null
  try {
    const doc = await payload.create({
      collection: 'webhook-events',
      data: {
        provider: 'stripe',
        eventId: event.id,
        eventType: event.type as string,
        processed: false,
      } as any,
      draft: false,
      overrideAccess: true,
    })
    webhookEventId = doc.id
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      payload.logger.info({ eventId: event.id }, 'Stripe webhook: event already received — deduped')
      return NextResponse.json({ received: true, deduped: true }, { status: 200 })
    }
    // Unexpected error — log and return 500 so provider retries
    payload.logger.error(
      { error: err, eventId: event.id },
      'Stripe webhook: unexpected error during dedup gate',
    )
    return NextResponse.json({ error: 'Dedup gate error' }, { status: 500 })
  }

  // 5. Route event by type
  try {
    await handleEvent(payload, event)
  } catch (err) {
    payload.logger.error({ error: err, eventType: event.type }, 'Stripe webhook handler error')
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  // 6. Mark event as processed
  if (webhookEventId) {
    await payload.update({
      collection: 'webhook-events',
      id: webhookEventId,
      data: { processed: true },
      overrideAccess: true,
    })
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
 * Tenant scoping: the coupon lookup is filtered by the transaction's tenant.
 * Global (tenant-less) coupons also match — they are found via
 * `tenant: { exists: false }` in the OR clause.
 *
 * @param payload - Payload instance
 * @param transaction - The succeeded transaction with appliedCoupon in metadata
 * @param tenantId - The tenant ID to scope coupon lookup
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
  tenantId: string,
): Promise<void> {
  const appliedCoupon = transaction.metadata?.appliedCoupon
  if (!appliedCoupon) return

  // Find the coupon by code, scoped to the transaction's tenant.
  // Also match global (tenant-less) coupons via the OR clause.
  const coupons = await payload.find({
    collection: 'coupons',
    where: {
      code: { equals: appliedCoupon.code },
      or: [{ tenant: { equals: tenantId } }, { tenant: { exists: false } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (coupons.totalDocs === 0) {
    payload.logger.warn({ code: appliedCoupon.code, tenantId }, 'Coupon not found for consumption')
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = event.data.object as any
      const paymentStatus = session.payment_status
      const stripePaymentIntentId = session.payment_intent as string | null

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

      // Only grant entitlements and flip to succeeded when payment_status === 'paid'.
      // For async payment methods (Klarna, ACH, SEPA) where payment_status is 'unpaid' or
      // 'pending', we leave the transaction pending — the async_payment_succeeded/failed
      // handlers will flip it later.
      if (paymentStatus !== 'paid') {
        payload.logger.info(
          { sessionId, paymentStatus },
          'Stripe webhook: checkout.session.completed with payment_status != paid — leaving pending',
        )
        return
      }

      // Idempotency: skip if entitlements already granted (replayed webhook)
      if (!transaction.entitlementsGrantedAt) {
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
          data: {
            status: 'succeeded',
            entitlementsGrantedAt: new Date().toISOString(),
            ...(stripePaymentIntentId ? { paymentIntentId: stripePaymentIntentId } : {}),
          },
          overrideAccess: true,
        })
      }

      // Coupon consumption — independent from entitlementsGrantedAt, idempotent via couponConsumedAt.
      // Attempt consumption if couponConsumedAt is null (regardless of entitlementsGrantedAt).
      // This is retry-safe: if first delivery fails in consumption (returns 500), retry will
      // still attempt consumption since couponConsumedAt is not set.
      const txMetadata = transaction.metadata as
        | {
            appliedCoupon?: {
              code: string
              discountType: string
              discountValue: number
              originalAmount?: number
              discountedAmount?: number
            } | null
          }
        | null
        | undefined
      if (!transaction.couponConsumedAt && txMetadata?.appliedCoupon) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await consumeCouponOnPayment(payload, transaction as any, transaction.tenant as string)
        } catch (err) {
          // Do NOT swallow — log and re-throw so the webhook returns 500 and provider retries.
          // Entitlements are already granted (idempotent), so retry is safe for coupon consumption.
          payload.logger.error(
            { error: err, transactionId: transaction.id },
            'Coupon consumption failed — returning 500 so provider retries',
          )
          throw err
        }
        // Consumption succeeded — record couponConsumedAt
        await payload.update({
          collection: 'transactions',
          id: transaction.id,
          data: { couponConsumedAt: new Date().toISOString() },
          overrideAccess: true,
        })
      }
      break
    }

    case 'checkout.session.async_payment_succeeded': {
      const sessionId = event.data.object.id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = event.data.object as any
      const stripePaymentIntentId = session.payment_intent as string | null

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
          'Stripe webhook: transaction not found for async_payment_succeeded',
        )
        return
      }

      const transaction = transactions.docs[0]

      // Idempotency: skip if entitlements already granted
      if (!transaction.entitlementsGrantedAt) {
        await grantProductEntitlements(
          transaction.user as string,
          transaction.product as string,
          transaction.id,
        )

        await payload.update({
          collection: 'transactions',
          id: transaction.id,
          data: {
            status: 'succeeded',
            entitlementsGrantedAt: new Date().toISOString(),
            ...(stripePaymentIntentId ? { paymentIntentId: stripePaymentIntentId } : {}),
          },
          overrideAccess: true,
        })
      }

      // Coupon consumption — independent from entitlementsGrantedAt, idempotent via couponConsumedAt.
      // Attempt consumption if couponConsumedAt is null (regardless of entitlementsGrantedAt).
      const asyncTxMetadata = transaction.metadata as
        | {
            appliedCoupon?: {
              code: string
              discountType: string
              discountValue: number
              originalAmount?: number
              discountedAmount?: number
            } | null
          }
        | null
        | undefined
      if (!transaction.couponConsumedAt && asyncTxMetadata?.appliedCoupon) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await consumeCouponOnPayment(payload, transaction as any, transaction.tenant as string)
        } catch (err) {
          payload.logger.error(
            { error: err, transactionId: transaction.id },
            'Coupon consumption failed — returning 500 so provider retries',
          )
          throw err
        }
        await payload.update({
          collection: 'transactions',
          id: transaction.id,
          data: { couponConsumedAt: new Date().toISOString() },
          overrideAccess: true,
        })
      }
      break
    }

    case 'checkout.session.async_payment_failed': {
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
          'Stripe webhook: transaction not found for async_payment_failed',
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
      const chargeAmount = event.data.object.amount as number | undefined
      const amountRefunded = event.data.object.amount_refunded as number | undefined

      // Look up by paymentIntentId first (pi_...), fall back to providerTransactionId
      // (cs_...) for backward compatibility with existing transactions created before
      // this fix was deployed.
      let transactions = await payload.find({
        collection: 'transactions',
        where: {
          paymentIntentId: { equals: paymentIntentId },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (transactions.totalDocs === 0) {
        // Fallback: look up by providerTransactionId (legacy path for old transactions)
        transactions = await payload.find({
          collection: 'transactions',
          where: {
            providerTransactionId: { equals: paymentIntentId },
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
      }

      if (transactions.totalDocs === 0) {
        payload.logger.warn(
          { paymentIntentId },
          'Stripe webhook: transaction not found for charge.refunded',
        )
        return
      }

      const transaction = transactions.docs[0]
      const existingRefundedAmount = (transaction.refundedAmount as number) || 0

      // Compute the delta: how much new refund this event introduces
      // Stripe events are cumulative, so delta = event amount_refunded - existing amount
      const delta = amountRefunded !== undefined ? amountRefunded - existingRefundedAmount : 0

      // If delta is 0 or negative, this event is already accounted for (idempotency)
      if (delta <= 0) {
        return
      }

      const newRefundedAmount = existingRefundedAmount + delta
      const isFullRefund =
        chargeAmount !== undefined && amountRefunded !== undefined && amountRefunded >= chargeAmount

      if (isFullRefund) {
        // Full refund: flip to refunded, set audit fields.
        // Omit refundedBy — do NOT overwrite an admin-set value from the admin refund route.
        await payload.update({
          collection: 'transactions',
          id: transaction.id,
          data: {
            status: 'refunded',
            refundedAmount: chargeAmount,
            refundedAt: new Date(event.created * 1000).toISOString(),
          },
          overrideAccess: true,
        })
      } else {
        // Partial refund: keep status as succeeded, update refundedAmount and audit timestamp.
        // Only set refundedBy if it's currently null (first partial refund);
        // subsequent partial refunds should not overwrite the already-set value.
        const updateData: Record<string, unknown> = {
          refundedAmount: newRefundedAmount,
          refundedAt: new Date(event.created * 1000).toISOString(),
        }
        if (!transaction.refundedBy) {
          updateData.refundedBy = null
        }
        await payload.update({
          collection: 'transactions',
          id: transaction.id,
          data: updateData,
          overrideAccess: true,
        })
      }
      break
    }

    default:
      // Unhandled event type — acknowledge without processing
      break
  }
}
