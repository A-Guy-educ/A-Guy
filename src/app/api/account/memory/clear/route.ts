/**
 * DELETE /api/account/memory/clear
 *
 * Deletes ALL memory items owned by the authenticated user.
 *
 * Access: Authenticated user only.
 */

import { getPayload } from 'payload'

import config from '@payload-config'

export async function DELETE(req: Request) {
  const payload = await getPayload({ config })

  // Auth check - return 401 if not authenticated
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authResult.user.id

  // Fetch all user's memory item IDs
  const result = await payload.find({
    collection: 'memory_items',
    where: {
      userId: { equals: userId },
    },
    limit: 0, // limit: 0 with pagination: false auto-disabled by Payload when limit === 0; fetches all matching docs
    depth: 0, // No relationships needed
    overrideAccess: true,
  })

  // Delete each item individually (no bulk delete in Payload Local API)
  // Using a sequential loop to avoid overwhelming the DB.
  let deletedCount = 0
  for (const doc of result.docs) {
    try {
      await payload.delete({
        collection: 'memory_items',
        id: doc.id,
        overrideAccess: true,
      })
      deletedCount++
    } catch {
      // Continue deleting other items even if one fails
    }
  }

  return Response.json({ success: true, deletedCount })
}
