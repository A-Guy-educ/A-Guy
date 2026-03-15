/**
 * Access Code Export API
 *
 * GET /api/access-codes/export?codeId=xyz123
 * Exports redemption data as CSV for admin reporting
 */

import { getPayload } from 'payload'

import config from '@payload-config'
import { AccountRole } from '@/server/payload/collections/Users/roles'

export async function GET(req: Request) {
  try {
    const payload = await getPayload({ config })

    // 1. Authenticate user and verify admin role
    const authResult = await payload.auth({ headers: req.headers })
    if (!authResult.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = authResult.user as { role?: string }
    if (user.role !== AccountRole.Admin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Get codeId from query params
    const url = new URL(req.url)
    const codeId = url.searchParams.get('codeId')

    if (!codeId) {
      return Response.json({ error: 'codeId required' }, { status: 400 })
    }

    // 3. Get all redemptions for this code
     
    const redemptions = await payload.find({
      collection: 'code-redemptions' as any,
      where: {
        code: { equals: codeId },
      },
      depth: 1, // Populate user
      overrideAccess: true,
    })

    // 4. Generate CSV
    const headers = ['Student Name', 'Email', 'Date Redeemed']
    const rows = redemptions.docs.map((redemption) => {
      const userData = redemption.user as { name?: string; email?: string } | null
      return [
        userData?.name || 'Unknown',
        userData?.email || 'Unknown',
        redemption.redeemedAt ? new Date(redemption.redeemedAt).toISOString() : '',
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    // 5. Return CSV response
    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="access-code-report-${codeId}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting access code data:', error)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
