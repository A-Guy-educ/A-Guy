/**
 * Stripe Webhook Handler
 *
 * POST /api/webhooks/stripe
 *
 * Verifies Stripe webhook signature, updates Transaction status, and grants
 * entitlements on successful payment. Always returns 200 to satisfy Stripe's
 * requirement for fast acknowledgment.
 *
 * @fileType api-route
 * @domain payments
 * @pattern webhook
 * @ai-summary Handles Stripe webhook events for payment confirmation and refunds
 */

import { NextRequest, NextResponse } from 'next/server'
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
    return NextResponse.json({ received: true }, { status: 200 })
  }

  // 3. Verify webhook signature
  let event: Stripe.Event
  try {
    event = await verifyStripeWebhook(rawBody, signature)
  } catch (err) {
    payload.logger.error({ error: err }, 'Stripe webhook signature verification failed')
    return NextResponse.json({ received: true }, { status: 200 })
  }

  // 4. Route event by type
  try {
    await handleEvent(payload, event)
  } catch (err) {
    payload.logger.error({ error: err, eventType: event.type }, 'Stripe webhook handler error')
  }

  return NextResponse.json({ received: true }, { status: 200 })
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

      // Idempotency: skip if already succeeded
      if (transaction.status === 'succeeded') {
        return
      }

      // Update status to succeeded
      await payload.update({
        collection: 'transactions',
        id: transaction.id,
        data: { status: 'succeeded' },
        overrideAccess: true,
      })

      // Grant entitlements
      try {
        await grantProductEntitlements(
          transaction.user as string,
          transaction.product as string,
          transaction.id,
        )
      } catch (err) {
        payload.logger.error(
          { error: err, transactionId: transaction.id },
          'Failed to grant product entitlements',
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
