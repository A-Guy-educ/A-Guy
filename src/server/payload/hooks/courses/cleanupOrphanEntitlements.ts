import type { CollectionAfterDeleteHook } from 'payload'

/**
 * After a course is deleted, remove any user `courseEntitlements` entries
 * that reference it. Prevents orphan entitlements that would otherwise
 * point to a non-existent course (causing "Unknown" entries in admin reports).
 */
export const cleanupOrphanEntitlements: CollectionAfterDeleteHook = async ({ id, req }) => {
  if (!id) return

  const usersWithEntitlement = await req.payload.find({
    collection: 'users',
    where: { 'courseEntitlements.course': { equals: id } },
    limit: 1000,
    overrideAccess: true,
    depth: 0,
    req,
  })

  let removedCount = 0

  for (const user of usersWithEntitlement.docs) {
    const u = user as unknown as {
      id: string
      courseEntitlements?: Array<{ course?: string | { id?: string } }>
    }
    const original = u.courseEntitlements || []
    const filtered = original.filter((ent) => {
      const courseId = typeof ent.course === 'object' ? ent.course?.id : ent.course
      return String(courseId) !== String(id)
    })

    if (filtered.length === original.length) continue

    await req.payload.update({
      collection: 'users',
      id: u.id,
      data: { courseEntitlements: filtered },
      overrideAccess: true,
      req,
    })

    removedCount += original.length - filtered.length
  }

  if (removedCount > 0) {
    req.payload.logger.info(
      `[cleanupOrphanEntitlements] Removed ${removedCount} entitlement(s) referencing deleted course ${id} from ${usersWithEntitlement.docs.length} user(s)`,
    )
  }
}
