/**
 * Admin Recent Transactions API
 *
 * GET /api/admin/recent-transactions
 * Returns the 5 most recent transactions with user email and product name.
 * Admin-only — returns 401 for unauthenticated and 403 for non-admin users.
 */

import { getPayload } from 'payload'

import config from '@payload-config'

interface TransactionUser {
  email?: string
}

interface TransactionProduct {
  name?: string
}

interface Transaction {
  id: string
  createdAt: string
  amount: number
  currency: string
  status: string
  user?: TransactionUser
  product?: TransactionProduct
}

interface TransactionsResponse {
  docs: Transaction[]
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })

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

  const result = await payload.find({
    collection: 'transactions',
    limit: 5,
    sort: '-createdAt',
    depth: 2,
    overrideAccess: true,
  })

  const docs: Transaction[] = result.docs.map((doc) => {
    const tx = doc as unknown as {
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
      user: tx.user ? { email: tx.user.email } : undefined,
      product: tx.product ? { name: tx.product.name } : undefined,
    }
  })

  const response: TransactionsResponse = { docs }

  return Response.json(response)
}
