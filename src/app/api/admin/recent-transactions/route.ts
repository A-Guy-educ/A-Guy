/**
 * Admin Recent Transactions API
 *
 * GET /api/admin/recent-transactions
 * Returns the 5 most recent transactions with user and product populated.
 * This is an internal admin endpoint that uses Payload's local API, avoiding
 * the CSRF/auth issues that occur when the RecentTransactionsWidget tries to
 * call Payload's REST API directly from the client.
 *
 * @fileType api-route
 * @domain admin
 * @ai-summary Recent transactions list for admin dashboard widget
 */

import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { AccountRole } from '@/server/payload/collections/Users/roles'

const DEFAULT_LIMIT = 5

export async function GET(req: Request) {
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

  // 3. Fetch recent transactions using Payload's local API
  // Using overrideAccess: true because this is an internal server-side endpoint
  // and the auth/admin check above already ensures the user is an admin.
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10), 10)

  const result = await payload.find({
    collection: 'transactions',
    limit,
    sort: '-createdAt',
    depth: 2,
    overrideAccess: true,
  })

  // Extract only the fields the RecentTransactionsWidget needs
  const transactions = result.docs.map((doc) => {
    const tx = doc as {
      id: string
      createdAt: string
      amount: number
      currency: string
      status: string
      user?: { email?: string }
      product?: { name?: string }
    }
    return {
      id: tx.id,
      createdAt: tx.createdAt,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      user: tx.user ? { email: (tx.user as { email?: string }).email } : undefined,
      product: tx.product ? { name: (tx.product as { name?: string }).name } : undefined,
    }
  })

  return NextResponse.json({ transactions })
}
