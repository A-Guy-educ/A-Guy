/**
 * Admin Recent Transactions API
 *
 * GET /api/admin/recent-transactions
 * Returns the 5 most recent transactions with depth=2 for the admin dashboard
 * Recent Transactions widget. Admin-only — returns 403 for non-admin users.
 *
 * @fileType api-route
 * @domain payments
 */

import { getPayload } from 'payload'

import config from '@payload-config'
import type { Transaction } from '@/payload-types'

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

  // Return in the same shape as the widget expects: { docs: Transaction[] }
  const docs = result.docs as Transaction[]
  return Response.json({ docs })
}
