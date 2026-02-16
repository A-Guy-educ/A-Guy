import type { CollectionAfterChangeHook } from 'payload'

/**
 * Cascades course title changes to related chapters' adminTitle field.
 *
 * This hook runs after a course is updated.
 * When the course title changes, it updates all related chapters'
 * adminTitle to reflect the new course title.
 */
export const cascadeAdminTitle: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  // Only run on update operations (new courses have no chapters yet)
  // Skip if already being cascaded from chapter updates
  if (req.context?.skipAdminTitleRecompute) {
    return doc
  }

  // Skip if title hasn't changed (performance optimization)
  if (previousDoc?.title === doc.title) {
    return doc
  }

  // Find all chapters that reference this course
  const chapters = await req.payload.find({
    collection: 'chapters',
    where: {
      course: { equals: doc.id },
    },
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    req,
  })

  // Update each chapter's adminTitle
  for (const chapter of chapters.docs) {
    const chapterTitle = chapter.title
    if (chapterTitle) {
      await req.payload.update({
        collection: 'chapters',
        id: chapter.id,
        data: {
          adminTitle: `${chapterTitle} — ${doc.title}`,
        },
        context: {
          skipAdminTitleRecompute: true,
        },
        req,
      })
    }
  }

  return doc
}
