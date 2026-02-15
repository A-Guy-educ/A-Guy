import type { CollectionAfterReadHook } from 'payload'

/**
 * Computes the adminTitle field for a chapter when reading.
 *
 * This hook runs after a chapter is read from the database.
 * It fetches the related course and creates a combined title
 * in the format: "Chapter Title — Course Title"
 *
 * This ensures that existing chapters (created before the adminTitle
 * feature) also display the correct label in relationship dropdowns.
 */
export const computeAdminTitleOnRead: CollectionAfterReadHook = async ({ doc, req }) => {
  // Don't compute if we already have a value (optimization)
  if (doc.adminTitle) {
    return doc
  }

  const chapterTitle = doc.title
  if (!chapterTitle) {
    return doc
  }

  // Get the course from the populated course relationship or fetch it
  let courseTitle: string | null = null

  if (doc.course && typeof doc.course === 'object' && 'title' in doc.course) {
    // Course is already populated (depth > 0)
    courseTitle = doc.course.title as string | null
  } else if (doc.course && typeof doc.course === 'string') {
    // Course is just an ID, need to fetch it
    try {
      const course = await req.payload.findByID({
        collection: 'courses',
        id: doc.course as string,
        depth: 0,
        overrideAccess: true,
        req,
      })
      courseTitle = course?.title || null
    } catch (error) {
      // If course lookup fails, we'll use just the chapter title
      console.error('Error fetching course for adminTitle:', error)
    }
  }

  if (courseTitle) {
    doc.adminTitle = `${chapterTitle} — ${courseTitle}`
  } else {
    // Fallback to just chapter title if course has no title
    doc.adminTitle = chapterTitle
  }

  return doc
}
