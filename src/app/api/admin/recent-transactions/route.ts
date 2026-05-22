/**
 * Admin Recent Transactions API
 *
 * GET /api/admin/recent-transactions
 * Returns the 5 most recent transactions for the admin dashboard widget.
 * Admin-only — returns 403 for non-admin users.
 *
 * @fileType api-route
 * @domain payments
 */

import { getPayload } from 'payload'

import config from '@payload-config'
import { AccountRole } from '@/server/payload/collections/Users/roles'

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
    authResult.user.role !== AccountRole.Admin
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Fetch recent transactions with overrideAccess to bypass collection-level access control
  const result = await payload.find({
    collection: 'transactions',
    limit: 5,
    sort: '-createdAt',
    depth: 2,
    overrideAccess: true,
  })

  return Response.json(result)
}
