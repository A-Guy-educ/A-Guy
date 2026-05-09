/**
 * DELETE /api/account/memory/[id]
 *
 * Deletes a single memory item owned by the authenticated user.
 *
 * Access: Authenticated user who owns the memory item.
 */

import { getPayload } from 'payload'

import config from '@payload-config'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config })

  // Auth check - return 401 if not authenticated
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const userId = authResult.user.id

  // Fetch the item first to verify ownership
  let doc: Record<string, unknown> | null = null
  try {
    doc = (await payload.findByID({
      collection: 'memory_items',
      id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Memory item not found' }, { status: 404 })
  }

  // Ownership check — userId is a scalar text field
  if ((doc as { userId?: string }).userId !== userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Delete with overrideAccess to bypass delete: isAdmin
  await payload.delete({
    collection: 'memory_items',
    id,
    overrideAccess: true,
  })

  return Response.json({ success: true })
}
