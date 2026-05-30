/**
 * User's own transaction fetch endpoint
 *
 * GET /api/account/transactions/{id}
 * Returns the transaction if it belongs to the authenticated user
 *
 * @fileType api-route
 * @domain billing
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import type { Transaction } from '@/payload-types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const payload = await getPayload({ config })

  // 1. Authenticate via JWT cookie
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Fetch the transaction
  let transaction: Transaction | null = null
  try {
    transaction = (await payload.findByID({
      collection: 'transactions',
      id,
      depth: 1,
      overrideAccess: true,
    })) as Transaction
  } catch (err) {
    if (err instanceof Error && (err.name === 'NotFound' || err.message.includes('Not Found'))) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }
    throw err
  }

  if (!transaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  // 3. Server-side authorization check: user can only see their own transactions
  const transactionUserId =
    typeof transaction.user === 'string' ? transaction.user : transaction.user?.id

  if (transactionUserId !== user.id) {
    // Return 404 to avoid leaking information about other users' transactions
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  return NextResponse.json({ transaction })
}
