/**
 * Admin Recent Transactions API
 *
 * GET /api/admin/recent-transactions
 * Returns the 5 most recent transactions for the admin dashboard RecentTransactionsWidget.
 * Admin-only — returns 401 for unauthenticated, 403 for non-admin users.
 *
 * @fileType api-route
 * @domain payments
 * @pattern admin-dashboard
 */

import { getPayload } from 'payload'

import config from '@payload-config'

interface RecentTransaction {
  id: string
  createdAt: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  user?: {
    email?: string
  }
  product?: {
    name?: string
  }
}

interface RecentTransactionsResponse {
  transactions: RecentTransaction[]
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })

  // 1. Authenticate
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Check admin role
  if (
    !('collection' in authResult.user) ||
    authResult.user.collection !== 'users' ||
    authResult.user.role !== 'admin'
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Fetch 5 most recent transactions with depth=2 to populate user and product
  const result = await payload.find({
    collection: 'transactions',
    limit: 5,
    sort: '-createdAt',
    depth: 2,
    overrideAccess: true,
  })

  const transactions: RecentTransaction[] = result.docs.map((doc) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = doc as any
    return {
      id: tx.id as string,
      createdAt: tx.createdAt as string,
      amount: tx.amount as number,
      currency: (tx.currency as string) || 'ILS',
      status: tx.status as 'pending' | 'succeeded' | 'failed' | 'refunded',
      user: tx.user
        ? {
            email:
              typeof tx.user === 'object' && tx.user !== null
                ? ((tx.user as { email?: string }).email ?? undefined)
                : undefined,
          }
        : undefined,
      product: tx.product
        ? {
            name:
              typeof tx.product === 'object' && tx.product !== null
                ? ((tx.product as { name?: string }).name ?? undefined)
                : undefined,
          }
        : undefined,
    }
  })

  const response: RecentTransactionsResponse = { transactions }
  return Response.json(response)
}
