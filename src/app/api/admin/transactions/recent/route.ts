/**
 * Admin Recent Transactions API
 *
 * GET /api/admin/transactions/recent?limit=5
 * Returns the most recent transactions with depth=2 for user/product info.
 * Admin-only — returns 403 for non-admin users.
 *
 * @fileType api-route
 * @domain payments
 * @pattern recent-transactions, admin-api
 */

import { getPayload } from 'payload'

import config from '@payload-config'

export interface RecentTransaction {
  id: string
  createdAt: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  user?: {
    id: string
    email?: string
    name?: string
  }
  product?: {
    id: string
    name?: string
  }
}

export interface RecentTransactionsResponse {
  docs: RecentTransaction[]
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })

  // Authenticate
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  if (
    !('collection' in authResult.user) ||
    authResult.user.collection !== 'users' ||
    authResult.user.role !== 'admin'
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Parse limit from query params (default 5, max 10)
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 10)

  // Fetch recent transactions using local API (bypasses REST API auth issues)
  const result = await payload.find({
    collection: 'transactions',
    limit,
    sort: '-createdAt',
    depth: 2,
    overrideAccess: true,
  })

  // Transform to the expected shape
  const docs: RecentTransaction[] = result.docs.map((doc) => {
    const tx = doc as unknown as {
      id: string
      createdAt: string
      amount: number
      currency: string
      status: 'pending' | 'succeeded' | 'failed' | 'refunded'
      user?: { id: string; email?: string; name?: string }
      product?: { id: string; name?: string }
    }
    return {
      id: tx.id,
      createdAt: tx.createdAt,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      user: tx.user
        ? {
            id:
              typeof tx.user === 'object' && tx.user !== null && 'id' in tx.user
                ? (tx.user as { id: string }).id
                : String(tx.user),
            email:
              typeof tx.user === 'object' && tx.user !== null && 'email' in tx.user
                ? (tx.user as { email?: string }).email
                : undefined,
            name:
              typeof tx.user === 'object' && tx.user !== null && 'name' in tx.user
                ? (tx.user as { name?: string }).name
                : undefined,
          }
        : undefined,
      product: tx.product
        ? {
            id:
              typeof tx.product === 'object' && tx.product !== null && 'id' in tx.product
                ? (tx.product as { id: string }).id
                : String(tx.product),
            name:
              typeof tx.product === 'object' && tx.product !== null && 'name' in tx.product
                ? (tx.product as { name?: string }).name
                : undefined,
          }
        : undefined,
    }
  })

  return Response.json({ docs })
}
