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
  let transaction: Record<string, unknown> | null = null
  try {
    transaction = (await payload.findByID({
      collection: 'transactions',
      id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown> | null
  } catch (err) {
    // Payload throws NotFound when the document doesn't exist
    if (err instanceof Error && (err.message === 'Not Found' || err.message.includes('NotFound'))) {
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

  try {
    if (provider === 'stripe') {
      await refundStripe(providerTransactionId, amount)
    } else if (provider === 'paypal') {
      await refundPayPal(providerTransactionId, amount)
    } else {
      return NextResponse.json({ error: 'Unknown payment provider' }, { status: 400 })
    }
  } catch (err) {
    payload.logger.error({ error: err, transactionId: id, provider }, 'Refund operation failed')
    return NextResponse.json({ error: 'Refund operation failed' }, { status: 500 })
  }

  // 6. Update status to refunded
  await payload.update({
    collection: 'transactions',
    id,
    data: { status: 'refunded' },
    overrideAccess: true,
  })

  return NextResponse.json({ success: true })
}
