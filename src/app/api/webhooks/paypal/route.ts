/**
 * PayPal Webhook Handler
 *
 * POST /api/webhooks/paypal
 *
 * Verifies PayPal webhook signature, updates Transaction status, and grants
 * entitlements on successful payment. Always returns 200 to satisfy PayPal's
 * requirement for fast acknowledgment.
 *
 * @fileType api-route
 * @domain payments
 * @pattern webhook
 * @ai-summary Handles PayPal webhook events for payment confirmation and refunds
 */

import { NextRequest, NextResponse } from 'next/server'

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
  event_type: string
  resource: PayPalWebhookResource
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })

  // 1. Parse body as JSON
  let body: object
  try {
    body = await request.json()
  } catch {
    payload.logger.error('Failed to parse PayPal webhook body')
    return NextResponse.json({ received: true }, { status: 200 })
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
      payload.logger.error('PayPal webhook signature verification failed')
      return NextResponse.json({ received: true }, { status: 200 })
    }
  } catch (err) {
    payload.logger.error({ error: err }, 'PayPal webhook signature verification error')
    return NextResponse.json({ received: true }, { status: 200 })
  }

  // 4. Route event by type
  const event = body as PayPalWebhookEvent
  try {
    await handleEvent(payload, event)
  } catch (err) {
    payload.logger.error(
      { error: err, eventType: event.event_type },
      'PayPal webhook handler error',
    )
  }

  return NextResponse.json({ received: true }, { status: 200 })
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

    case 'PAYMENT.CAPTURE.COMPLETED': {
      // The capture ID is in resource.id, but we need the order ID to find the transaction.
      // Try to get the order ID from supplementary_data.related_ids.order_id
      const orderId = event.resource.supplementary_data?.related_ids?.order_id || event.resource.id

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

      // Idempotency guard: only process if still pending
      if (transaction.status !== 'pending') {
        return
      }

      await payload.update({
        collection: 'transactions',
        id: transaction.id,
        data: { status: 'succeeded' },
        overrideAccess: true,
      })
      break
    }

    case 'PAYMENT.CAPTURE.REFUNDED': {
      const captureId = event.resource.id

      const transactions = await payload.find({
        collection: 'transactions',
        where: {
          providerTransactionId: { equals: captureId },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (transactions.totalDocs === 0) {
        payload.logger.warn(
          { captureId },
          'PayPal webhook: transaction not found for PAYMENT.CAPTURE.REFUNDED',
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
