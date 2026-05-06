import type { CollectionAfterDeleteHook } from 'payload'
import { ObjectId } from 'mongodb'

/**
 * After a course is deleted, remove any user `courseEntitlements` entries
 * that reference it. Prevents orphan entitlements that would otherwise
 * point to a non-existent course (causing "Unknown" entries in admin reports).
 */
export const cleanupOrphanEntitlements: CollectionAfterDeleteHook = async ({ id, req }) => {
  if (!id) return

  const PAGE_SIZE = 500
  let removedCount = 0
  let usersModified = 0

  // Phase 1 — collect all affected user IDs before mutating any document.
  // This prevents the cursor-invalidation bug where advancing `page` after
  // updating page-1 users would skip the next batch when the result set shrinks.
  const collectedIds: string[] = []
  let page = 1
  while (true) {
    const usersWithEntitlement = await req.payload.find({
      collection: 'users',
      where: { 'courseEntitlements.course': { equals: id } },
      limit: PAGE_SIZE,
      page,
      overrideAccess: true,
      depth: 0,
      req,
    })

    for (const user of usersWithEntitlement.docs) {
      collectedIds.push(user.id)
    }

    if (!usersWithEntitlement.hasNextPage) break
    page++
  }

  // Phase 2 — remove the orphan entitlement from all affected users in a single
  // bulk write. Using raw MongoDB $pull avoids one round-trip per user (550 → 1).
  if (collectedIds.length > 0) {
    const db = (req.payload.db as any).connection?.db as import('mongodb').Db
    await db
      .collection('users')
      .updateMany({ _id: { $in: collectedIds.map((id) => new ObjectId(id)) } }, {
        $pull: { courseEntitlements: { course: new ObjectId(id) } },
      } as any)
    usersModified = collectedIds.length
    removedCount = collectedIds.length // each user had exactly 1 entitlement to this course
  }

  if (removedCount > 0) {
    req.payload.logger.info(
      `[cleanupOrphanEntitlements] Removed ${removedCount} entitlement(s) referencing deleted course ${id} from ${usersModified} user(s)`,
    )
  }
}
