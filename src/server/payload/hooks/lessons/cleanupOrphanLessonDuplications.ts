import type { CollectionAfterDeleteHook } from 'payload'

/**
 * After a lesson is deleted, delete any LessonDuplications that reference it
 * (either as sourceLesson or outputLesson). Without this hook, stale references
 * remain in the DB, causing broken UI in the duplication review screen and potential
 * errors when the pipeline tries to process them.
 */
export const cleanupOrphanLessonDuplications: CollectionAfterDeleteHook = async ({ id, req }) => {
  if (!id) return

  // Delete LessonDuplications where this lesson is the source
  const asSource = await req.payload.find({
    collection: 'lesson-duplications',
    where: { sourceLesson: { equals: id } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  })

  for (const dup of asSource.docs) {
    await req.payload.delete({
      collection: 'lesson-duplications',
      id: dup.id,
      overrideAccess: true,
      req,
    })
  }

  // Delete LessonDuplications where this lesson is the output
  const asOutput = await req.payload.find({
    collection: 'lesson-duplications',
    where: { outputLesson: { equals: id } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  })

  for (const dup of asOutput.docs) {
    await req.payload.delete({
      collection: 'lesson-duplications',
      id: dup.id,
      overrideAccess: true,
      req,
    })
  }

  const total = asSource.docs.length + asOutput.docs.length
  if (total > 0) {
    req.payload.logger.info(
      `[cleanupOrphanLessonDuplications] Deleted ${total} lesson-duplication(s) for deleted lesson ${id}`,
    )
  }
}
