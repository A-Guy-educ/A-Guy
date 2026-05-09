/**
 * Memory Items API
 *
 * GET /api/account/memory
 * Returns all memory items for the authenticated user.
 * Used by the /account memory section to display and delete memories.
 *
 * Access: Authenticated user only. Only returns items where userId matches the user's ID.
 */

import { getPayload } from 'payload'

import config from '@payload-config'

export async function GET(req: Request) {
  const payload = await getPayload({ config })

  // Auth check - return 401 if not authenticated
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authResult.user.id

  // Fetch user's memory items — use overrideAccess: true because
  // collection-level read access restricts to admins, but we verified
  // ownership by filtering on userId below.
  const result = await payload.find({
    collection: 'memory_items',
    where: {
      userId: { equals: userId },
    },
    sort: '-createdAt',
    limit: 100,
    depth: 0, // No relationships needed for display
    overrideAccess: true,
  })

  return Response.json({
    items: result.docs.map((doc) => ({
      id: doc.id,
      type: doc.type,
      text: doc.text,
      importance: doc.importance,
      status: doc.status,
      contextKey: doc.contextKey,
      contextLevel: doc.contextLevel,
      createdAt: doc.createdAt,
    })),
    total: result.totalDocs,
  })
}
