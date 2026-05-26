/**
 * PayPal Webhook Handler
 *
 * POST /api/webhooks/paypal
 *
 * Verifies PayPal webhook signature, updates Transaction status, and grants
 * entitlements on successful payment. Returns 400 for bad signatures (no retry),
 * 500 for transient errors (provider will retry), and 200 for downstream
 * processing errors that should not be retried.
 *
 * @fileType api-route
 * @domain payments
 * @pattern webhook
 * @ai-summary Handles PayPal webhook events for payment confirmation and refunds
 */

import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'

import { getPayload } from 'payload'
import config from '@payload-config'

import { grantProductEntitlements } from '@/lib/payment/grant-entitlements'
import { verifyPayPalWebhook } from '@/lib/payment/paypal'

interface PayPalWebhookResource {
  id: string
  supplementary_data?: {
    related_ids?: {
      order_id?: string
    }
  }
}

interface PayPalWebhookEvent {
  id: string
  event_type: string
  resource: PayPalWebhookResource
}

/**
 * MongoDB duplicate-key error detection (code 11000 or E11000 in message).
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

  // 1. Parse body as JSON
  let body: object
  try {
    body = await request.json()
  } catch {
    const sourceIp =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const bodySnippet = request.headers.get('content-type') || ''
    payload.logger.warn({ sourceIp, bodySnippet }, 'PayPal webhook: failed to parse JSON body')
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // 2. Extract PayPal headers for signature verification
  const headers: Record<string, string> = {
    'paypal-transmission-id': request.headers.get('paypal-transmission-id') || '',
    'paypal-transmission-time': request.headers.get('paypal-transmission-time') || '',
    'paypal-transmission-sig': request.headers.get('paypal-transmission-sig') || '',
    'paypal-cert-url': request.headers.get('paypal-cert-url') || '',
    'paypal-auth-algo': request.headers.get('paypal-auth-algo') || '',
  }

  // 3. Verify webhook signature
  try {
    const isValid = await verifyPayPalWebhook(body, headers)
    if (!isValid) {
      const sourceIp =
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      const bodySnippet = JSON.stringify(body).slice(0, 100)
      payload.logger.warn(
        { sourceIp, bodySnippet },
        'PayPal webhook signature verification failed — returning 400',
      )
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  } catch (err) {
    const sourceIp =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const bodySnippet = JSON.stringify(body).slice(0, 100)

    const errorMessage = err instanceof Error ? err.message : String(err)

    // Permanent errors (bad config or malformed headers) → 400, PayPal will not retry
    if (
      errorMessage.includes('Missing PAYPAL_WEBHOOK_ID') ||
      errorMessage.includes('Missing required PayPal webhook headers')
    ) {
      payload.logger.error(
        { error: err, sourceIp, bodySnippet },
        'PayPal webhook misconfiguration — returning 400',
      )
      return NextResponse.json({ error: 'Invalid webhook configuration' }, { status: 400 })
    }

    // Transient error (network issue calling PayPal verify API) → 500, PayPal will retry
    payload.logger.error(
      { error: err, sourceIp, bodySnippet },
      'PayPal webhook signature verification threw transient error — returning 500',
    )
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }

  // 4. Dedup gate — attempt to create WebhookEvents doc.
  // On duplicate-key error the event was already received → return 200 immediately.
  const event = body as PayPalWebhookEvent
  let webhookEventId: string | null = null
  try {
    const doc = await payload.create({
      collection: 'webhook-events',
      data: {
        provider: 'paypal',
        eventId: event.id,
        eventType: event.event_type as string,
        processed: false,
      } as any,
      draft: false,
      overrideAccess: true,
    })
    webhookEventId = doc.id
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      payload.logger.info(
        { eventId: event.id, eventType: event.event_type },
        'PayPal webhook: event already received — deduped',
      )
      return NextResponse.json({ received: true, deduped: true }, { status: 200 })
    }
    // Unexpected error — log and return 500 so provider retries
    payload.logger.error(
      { error: err, eventId: event.id },
      'PayPal webhook: unexpected error during dedup gate',
    )
    return NextResponse.json({ error: 'Dedup gate error' }, { status: 500 })
  }

  // 5. Route event by type
  try {
    await handleEvent(payload, event)
  } catch (err) {
    payload.logger.error(
      { error: err, eventType: event.event_type },
      'PayPal webhook handler error',
    )
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
  event: PayPalWebhookEvent,
): Promise<void> {
  switch (event.event_type) {
    case 'CHECKOUT.ORDER.APPROVED': {
      const orderId = event.resource.id

      const transactions = await payload.find({
        collection: 'transactions',
        where: {
          providerTransactionId: { equals: orderId },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (transactions.totalDocs === 0) {
        payload.logger.warn({ orderId }, 'PayPal webhook: transaction not found')
        return
      }

      const transaction = transactions.docs[0]

      // Idempotency: skip if entitlements already granted (replayed webhook)
      if (transaction.entitlementsGrantedAt) {
        return
      }

      // Entitlements are granted only on PAYMENT.CAPTURE.COMPLETED (when funds are actually captured).
      // CHECKOUT.ORDER.APPROVED only validates the order exists and returns success.
      break
    }

    case 'PAYMENT.CAPTURE.COMPLETED': {
      // The capture ID is in resource.id, but we need the order ID to find the transaction.
      // Try to get the order ID from supplementary_data.related_ids.order_id
      const orderId = event.resource.supplementary_data?.related_ids?.order_id || event.resource.id
      const captureId = event.resource.id

      const transactions = await payload.find({
        collection: 'transactions',
        where: {
          providerTransactionId: { equals: orderId },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (transactions.totalDocs === 0) {
        payload.logger.warn(
          { orderId },
          'PayPal webhook: transaction not found for PAYMENT.CAPTURE.COMPLETED',
        )
        return
      }

      const transaction = transactions.docs[0]

      // Idempotency: skip if entitlements already granted (replayed webhook)
      if (!transaction.entitlementsGrantedAt) {
        // Grant entitlements BEFORE flipping status to succeeded — fail-safe:
        // if grant throws we do NOT set status=succeeded so the provider retries.
        await grantProductEntitlements(
          transaction.user as string,
          transaction.product as string,
          transaction.id,
        )

        // Grant succeeded — atomically flip status and record the grant timestamp and captureId
        await payload.update({
          collection: 'transactions',
          id: transaction.id,
          data: {
            status: 'succeeded',
            entitlementsGrantedAt: new Date().toISOString(),
            captureId,
          },
          overrideAccess: true,
        })
      }

      // Coupon consumption — independent from entitlementsGrantedAt, idempotent via couponConsumedAt.
      // Attempt consumption if couponConsumedAt is null (regardless of entitlementsGrantedAt).
      const paypalTxMetadata = transaction.metadata as
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
      if (!transaction.couponConsumedAt && paypalTxMetadata?.appliedCoupon) {
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

    case 'PAYMENT.CAPTURE.REFUNDED': {
      const captureId = event.resource.id

      // Primary lookup via captureId (populated on PAYMENT.CAPTURE.COMPLETED)
      const transactions = await payload.find({
        collection: 'transactions',
        where: {
          captureId: { equals: captureId },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (transactions.totalDocs === 0) {
        // Fallback for legacy transactions created before captureId was added.
        // These have providerTransactionId set to the capture ID value (before the bug was fixed).
        const fallback = await payload.find({
          collection: 'transactions',
          where: {
            providerTransactionId: { equals: captureId },
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (fallback.totalDocs === 0) {
          payload.logger.warn(
            { captureId },
            'PayPal webhook: transaction not found for PAYMENT.CAPTURE.REFUNDED',
          )
          return
        }
        await payload.update({
          collection: 'transactions',
          id: fallback.docs[0].id,
          data: { status: 'refunded' },
          overrideAccess: true,
        })
        break
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
