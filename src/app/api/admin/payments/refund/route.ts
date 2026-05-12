/**
 * Payment Refund API
 *
 * @fileType api-route
 * @domain payments
 * @ai-summary Admin endpoint for processing refunds
 */

import { getPayload } from 'payload'

import config from '@payload-config'
import { revokeEntitlementsOnCancellation } from '@/server/services/payment/grants'

import type { Transaction } from '@/payload-types'

export async function POST(req: Request): Promise<Response> {
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

  const adminId =
    typeof authResult.user === 'object' && 'id' in authResult.user
      ? (authResult.user as { id: string }).id
      : (authResult.user as string)

  try {
    const body = await req.json()
    const { transactionId } = body as { transactionId: string }

    if (!transactionId) {
      return Response.json({ error: 'transactionId is required' }, { status: 400 })
    }

    // Fetch transaction
    const transaction = (await payload.findByID({
      collection: 'transactions',
      id: transactionId,
      depth: 2,
      overrideAccess: true,
    })) as Transaction | null

    if (!transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (transaction.status !== 'completed') {
      return Response.json(
        { error: 'Only completed transactions can be refunded' },
        { status: 400 },
      )
    }

    // In a real implementation, this would call Tranzila's refund API
    // For now, we simulate the refund

    const now = new Date().toISOString()

    // Update transaction to refunded
    await payload.update({
      collection: 'transactions',
      id: transactionId,
      data: {
        status: 'refunded',
        refundedAt: now,
        refundedBy: adminId,
      },
      overrideAccess: true,
    })

    // Revoke entitlements for the user
    const userId =
      typeof transaction.user === 'string'
        ? transaction.user
        : (transaction.user as { id: string })?.id

    await revokeEntitlementsOnCancellation({
      payload,
      userId,
    })

    payload.logger.info({ transactionId, adminId, userId }, '[payment-refund] Refund processed')

    return Response.json({
      success: true,
      message: 'Refund processed successfully',
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    payload.logger.error({ error: errorMsg }, '[payment-refund] Handler error')
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
