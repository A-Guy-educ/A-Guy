/**
 * Transactions List API
 *
 * GET /api/collections/transactions?limit=5&sort=-createdAt&depth=2
 * Admin-only — returns recent transactions for the admin dashboard widget.
 *
 * @fileType api-route
 * @domain payments
 */

import { getPayload } from 'payload'

import config from '@payload-config'

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (authResult.user as any).role !== 'admin'
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 100)
  const sort = url.searchParams.get('sort') || '-createdAt'
  const depth = parseInt(url.searchParams.get('depth') || '2', 10)

  const result = await payload.find({
    collection: 'transactions',
    limit,
    sort: sort as string,
    depth: Math.min(depth, 5) as number,
    overrideAccess: true,
  })

  return Response.json({ docs: result.docs })
}
