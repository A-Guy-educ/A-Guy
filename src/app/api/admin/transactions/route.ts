/**
 * Admin Transactions List API
 *
 * GET /api/admin/transactions?limit=5&sort=-createdAt&depth=2
 * Returns recent transactions for the admin dashboard.
 * Admin-only — returns 401/403 for non-admin users.
 */

import { getPayload } from 'payload'
import { NextRequest } from 'next/server'

import config from '@payload-config'

/**
 * Extract pagination and sort parameters from the request URL.
 */
function parseParams(url: URL): {
  limit: number
  sort: string
  depth: number
} {
  return {
    limit: parseInt(url.searchParams.get('limit') || '5', 10),
    sort: url.searchParams.get('sort') || '-createdAt',
    depth: parseInt(url.searchParams.get('depth') || '2', 10),
  }
}

/**
 * Check if the request is from an admin user.
 */
async function isAdminRequest(req: Request): Promise<boolean> {
  const payload = await getPayload({ config })
  const authResult = await payload.auth({ headers: req.headers })

  if (!authResult.user) {
    return false
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = authResult.user as any
  return user?.collection === 'users' && user?.role === 'admin'
}

export async function GET(req: NextRequest): Promise<Response> {
  // Check admin authentication
  const isAdmin = await isAdminRequest(req)
  if (!isAdmin) {
    // Check if there's a user but not admin
    const payload = await getPayload({ config })
    const authResult = await payload.auth({ headers: req.headers })
    if (authResult.user) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const { limit, sort, depth } = parseParams(new URL(req.url))

  const result = await payload.find({
    collection: 'transactions',
    limit,
    sort,
    depth,
    overrideAccess: true, // Already checked admin above
  })

  return Response.json(result)
}
