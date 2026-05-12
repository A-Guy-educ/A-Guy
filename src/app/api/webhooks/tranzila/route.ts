/**
 * Tranzila Webhook Handler
 *
 * @fileType api-route
 * @domain payments
 * @ai-summary Receives Tranzila payment callbacks
 */

import { getPayload } from 'payload'

import config from '@payload-config'
import {
  parseCallback,
  verifyCallback,
  type TranzilaCallback,
} from '@/server/services/payment/tranzila'
import { grantEntitlementAfterPurchase } from '@/server/services/payment/grants'

import type { Transaction } from '@/payload-types'

export async function POST(req: Request): Promise<Response> {
  const payload = await getPayload({ config })

  try {
    const callbackParams = new URLSearchParams(await req.text())

    const callbackSecret = process.env.TRANZILA_CALLBACK_SECRET
    if (!callbackSecret) {
      payload.logger.error('[tranzila-webhook] TRANZILA_CALLBACK_SECRET not configured')
      return new Response('OK', { status: 200 }) // Return OK to stop Tranzila retries
    }

    // Verify callback signature
    const isValid = await verifyCallback(callbackParams, callbackSecret)
    if (!isValid) {
      payload.logger.warn('[tranzila-webhook] Invalid HMAC signature')
      return new Response('Forbidden', { status: 403 })
    }

    const callback = parseCallback(callbackParams) as TranzilaCallback
    const orderId = callback.OrderId

    // Find pending transaction
    const transactionResult = await payload.find({
      collection: 'transactions',
      where: { tranzilaOrderId: { equals: orderId } },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })

    if (transactionResult.totalDocs === 0) {
      payload.logger.error({ orderId }, '[tranzila-webhook] Transaction not found')
      return new Response('OK', { status: 200 }) // Idempotent - return OK
    }

    const transaction = transactionResult.docs[0] as Transaction

    // Idempotent - already processed
    if (transaction.status !== 'pending') {
      payload.logger.info(
        { orderId, status: transaction.status },
        '[tranzila-webhook] Already processed',
      )
      return new Response('OK', { status: 200 })
    }

    // Update transaction with Tranzila response
    await payload.update({
      collection: 'transactions',
      id: transaction.id,
      data: {
        tranzilaTransactionId: callback.TXnID,
        tranzilaResponse: callback as unknown as Record<string, unknown>,
        paymentMethod: callback.CCNative ? 'credit_card' : 'other',
      },
      overrideAccess: true,
    })

    if (callback.Status === 'approved') {
      // Payment successful - grant entitlement
      const userId =
        typeof transaction.user === 'string'
          ? transaction.user
          : (transaction.user as { id: string })?.id

      const pricingPlanId =
        typeof transaction.pricingPlan === 'string'
          ? transaction.pricingPlan
          : (transaction.pricingPlan as { id: string })?.id

      await grantEntitlementAfterPurchase({
        payload,
        userId,
        pricingPlanId,
        transactionId: transaction.id,
      })

      // Update transaction status to completed
      await payload.update({
        collection: 'transactions',
        id: transaction.id,
        data: { status: 'completed' },
        overrideAccess: true,
      })

      payload.logger.info(
        { orderId, transactionId: transaction.id, userId },
        '[tranzila-webhook] Payment completed, entitlement granted',
      )
    } else if (callback.Status === 'failed') {
      // Payment failed
      await payload.update({
        collection: 'transactions',
        id: transaction.id,
        data: {
          status: 'failed',
          failureReason: callback.IntIs || 'Payment declined',
        },
        overrideAccess: true,
      })

      payload.logger.warn(
        { orderId, transactionId: transaction.id },
        '[tranzila-webhook] Payment failed',
      )
    }

    // Tranzila expects text response
    return new Response('OK', { status: 200 })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    payload.logger.error({ error: errorMsg }, '[tranzila-webhook] Handler error')

    // Return 500 so Tranzila will retry. This ensures we don't silently lose
    // payment confirmations. The idempotency check at lines 59-66 ensures
    // already-processed transactions are safely skipped on retry.
    return new Response('Internal server error', { status: 500 })
  }
}
