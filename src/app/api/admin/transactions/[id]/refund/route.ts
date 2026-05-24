/**
 * Transaction Refund Endpoint
 *
 * POST /api/admin/transactions/{id}/refund
 * Admin-only — calls refundStripe or refundPayPal and updates status to 'refunded'
 *
 * @fileType api-route
 * @domain payments
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import type { Transaction } from '@/payload-types'
import { refundStripe } from '@/lib/payment/stripe'
import { refundPayPal } from '@/lib/payment/paypal'
import { AccountRole } from '@/server/payload/collections/Users/roles'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const payload = await getPayload({ config })

  // 1. Authenticate
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Check admin role
  if (
    !('collection' in authResult.user) ||
    authResult.user.collection !== 'users' ||
    authResult.user.role !== AccountRole.Admin
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Fetch transaction
  let transaction: Transaction | null = null
  try {
    transaction = (await payload.findByID({
      collection: 'transactions',
      id,
      depth: 0,
      overrideAccess: true,
    })) as Transaction
  } catch (err) {
    // Handle both operational errors and not-found errors
    if (err instanceof Error && (err.name === 'NotFound' || err.message.includes('Not Found'))) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }
    throw err
  }

  if (!transaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  // 4. Validate status — double-refund guard
  if (transaction.status === 'refunded') {
    return NextResponse.json({ error: 'העסקה כבר הוחזרה' }, { status: 400 })
  }

  if (transaction.status !== 'succeeded') {
    return NextResponse.json(
      { error: 'Only succeeded transactions can be refunded' },
      { status: 400 },
    )
  }

  // 5. Call provider refund
  const { provider, providerTransactionId, amount } = transaction as {
    provider: 'stripe' | 'paypal'
    providerTransactionId: string
    amount: number
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentIntentId = (transaction as any).paymentIntentId as string | null

  try {
    if (provider === 'stripe') {
      // Use paymentIntentId (pi_...) if available, fall back to providerTransactionId (cs_...)
      // for legacy transactions created before the paymentIntentId field was added.
      const refundId = paymentIntentId ?? providerTransactionId
      await refundStripe(id, refundId, amount)
    } else if (provider === 'paypal') {
      await refundPayPal(providerTransactionId, amount)
    } else {
      return NextResponse.json({ error: 'Unknown payment provider' }, { status: 400 })
    }
  } catch (err) {
    payload.logger.error({ error: err, transactionId: id, provider }, 'Refund operation failed')
    return NextResponse.json({ error: 'Refund operation failed' }, { status: 500 })
  }

  // 6. Update status to refunded with audit fields
  await payload.update({
    collection: 'transactions',
    id,
    data: {
      status: 'refunded',
      refundedAmount: amount,
      refundedBy: authResult.user.id,
      refundedAt: new Date().toISOString(),
    },
    context: { skipTransitionGuard: false },
    overrideAccess: true,
  })

  return NextResponse.json({ success: true })
}
