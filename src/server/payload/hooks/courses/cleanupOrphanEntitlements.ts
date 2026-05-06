import type { CollectionAfterDeleteHook } from 'payload'

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

  // Phase 2 — remove the orphan entitlement from each collected user.
  // No mutations happen in phase 1, so the cursor is stable throughout.
  for (const userId of collectedIds) {
    const user = (await req.payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
      depth: 0,
      req,
    })) as unknown as {
      id: string
      courseEntitlements?: Array<{ course?: string | { id?: string } }>
    } | null

    if (!user) continue

    const original = user.courseEntitlements || []
    const filtered = original.filter((ent) => {
      const courseId = typeof ent.course === 'object' ? ent.course?.id : ent.course
      return String(courseId) !== String(id)
    })

    if (filtered.length === original.length) continue

    await req.payload.update({
      collection: 'users',
      id: userId,
      data: { courseEntitlements: filtered },
      overrideAccess: true,
      req,
    })

    removedCount += original.length - filtered.length
    usersModified++
  }

  if (removedCount > 0) {
    req.payload.logger.info(
      `[cleanupOrphanEntitlements] Removed ${removedCount} entitlement(s) referencing deleted course ${id} from ${usersModified} user(s)`,
    )
  }
}
