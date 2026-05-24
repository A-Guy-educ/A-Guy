/**
 * Admin Recent Transactions API
 *
 * GET /api/admin/recent-transactions?limit=5
 * Returns the most recent transactions with user and product info.
 * Admin-only — returns 401 for unauthenticated, 403 for non-admin users.
 *
 * This endpoint exists because the Payload REST API at /api/collections/transactions
 * returns HTTP 404 for non-admin users (security: don't reveal resource existence).
 * The widget expects a proper error response it can handle, not a 404.
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

export async function GET(req: Request) {
  const payload = await getPayload({ config })

  // Authenticate the user via cookie/JWT
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  if (
    !('collection' in authResult.user) ||
    authResult.user.collection !== 'users' ||
    authResult.user.role !== 'admin'
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 20)

  // Fetch recent transactions with overrideAccess to bypass collection-level adminOnly
  const result = await payload.find({
    collection: 'transactions',
    limit,
    sort: '-createdAt',
    depth: 2,
    overrideAccess: true,
  })

  const transactions: RecentTransaction[] = result.docs.map((doc) => {
    const tx = doc as unknown as {
      id: string
      createdAt: string
      amount: number
      currency: string
      status: 'pending' | 'succeeded' | 'failed' | 'refunded'
      user?: { email?: string }
      product?: { name?: string }
    }
    return {
      id: tx.id,
      createdAt: tx.createdAt,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      user: tx.user
        ? {
            email:
              typeof tx.user === 'object' && tx.user !== null
                ? (tx.user as { email?: string }).email
                : undefined,
          }
        : undefined,
      product: tx.product
        ? {
            name:
              typeof tx.product === 'object' && tx.product !== null
                ? (tx.product as { name?: string }).name
                : undefined,
          }
        : undefined,
    }
  })

  return Response.json({ docs: transactions })
}
