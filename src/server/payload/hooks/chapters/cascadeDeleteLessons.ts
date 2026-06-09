import type { CollectionAfterDeleteHook } from 'payload'

/**
 * After a chapter is deleted, cascade-delete all related lessons.
 *
 * This ensures that when a chapter is deleted via Payload's standard delete
 * (bypassing the /api/cascade-delete endpoint), its lessons are also removed.
 * Without this hook, lessons become orphaned with a stale chapter reference,
 * causing 404 errors when anything tries to fetch them by ID.
 */
export const cascadeDeleteLessons: CollectionAfterDeleteHook = async ({ id, req }) => {
  if (!id) return

  // Find all lessons belonging to this chapter
  const lessons = await req.payload.find({
    collection: 'lessons',
    where: { chapter: { equals: id } },
    limit: 0, // all
    depth: 0,
    overrideAccess: true,
    req,
  })

  // Cascade-delete each lesson (this will also trigger Exercises afterDelete hooks
  // to remove exercise blocks from lessons)
  for (const lesson of lessons.docs) {
    await req.payload.delete({
      collection: 'lessons',
      id: lesson.id,
      overrideAccess: true,
      req,
    })
  }

  if (lessons.docs.length > 0) {
    req.payload.logger.info(
      `[cascadeDeleteLessons] Deleted ${lessons.docs.length} lesson(s) for deleted chapter ${id}`,
    )
  }
}
