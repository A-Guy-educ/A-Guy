import type { CollectionAfterDeleteHook } from 'payload'
import { ObjectId } from 'mongodb'

/**
 * After a course is deleted, set any enrollment status to 'cancelled'
 * for enrollments referencing the deleted course. Preserves enrollment
 * history for analytics and reporting.
 */
export const cleanupOrphanEnrollments: CollectionAfterDeleteHook = async ({ id, req }) => {
  if (!id) return

  const PAGE_SIZE = 500
  let updatedCount = 0

  // Phase 1 — collect all affected enrollment IDs before mutating
  const collectedEnrollmentIds: string[] = []
  let page = 1
  while (true) {
    const enrollments = await req.payload.find({
      collection: 'enrollments',
      where: {
        and: [{ course: { equals: id } }, { status: { not_equals: 'cancelled' } }],
      },
      limit: PAGE_SIZE,
      page,
      overrideAccess: true,
      depth: 0,
      req,
    })

    for (const enrollment of enrollments.docs) {
      collectedEnrollmentIds.push(enrollment.id)
    }

    if (!enrollments.hasNextPage) break
    page++
  }

  // Phase 2 — update all affected enrollments to 'cancelled' status
  // Uses bulk write for efficiency
  if (collectedEnrollmentIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (req.payload.db as any).connection?.db as import('mongodb').Db
    const now = new Date()
    await db
      .collection('enrollments')
      .updateMany({ _id: { $in: collectedEnrollmentIds.map((eid) => new ObjectId(eid)) } }, {
        $set: {
          status: 'cancelled',
          cancelledAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    updatedCount = collectedEnrollmentIds.length
  }

  if (updatedCount > 0) {
    req.payload.logger.info(
      `[cleanupOrphanEnrollments] Set ${updatedCount} enrollment(s) to cancelled for deleted course ${id}`,
    )
  }
}
