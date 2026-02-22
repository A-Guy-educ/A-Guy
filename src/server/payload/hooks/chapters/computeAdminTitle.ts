import { logger } from '@/infra/utils/logger'
import type { CollectionBeforeChangeHook } from 'payload'

const log = logger.child({ hook: 'computeAdminTitle' })

/**
 * Computes the adminTitle field for a chapter.
 *
 * This hook runs before a chapter is created or updated.
 * It fetches the related course and creates a combined title
 * in the format: "Chapter Title — Course Title"
 *
 * The adminTitle is used as the display label in relationship dropdowns
 * (e.g., when selecting a chapter in the Lesson admin).
 */
export const computeAdminTitle: CollectionBeforeChangeHook = async ({ data, req }) => {
  // Skip if adminTitle computation is being handled by the cascade hook
  if (req.context?.skipAdminTitleRecompute) {
    return data
  }

  const chapterTitle = data?.title
  if (!chapterTitle) {
    return data
  }

  // Get the course ID from the data (new/changed) or originalDoc
  const courseId = data?.course

  if (courseId) {
    try {
      // Fetch the related course to get its title
      const course = await req.payload.findByID({
        collection: 'courses',
        id: courseId as string,
        depth: 0,
        overrideAccess: true,
        req,
      })

      const courseTitle = course?.title

      if (courseTitle) {
        data.adminTitle = `${chapterTitle} — ${courseTitle}`
      } else {
        // Fallback to just chapter title if course has no title
        data.adminTitle = chapterTitle
      }
    } catch (error) {
      // If course lookup fails, fall back to chapter title only
      log.error({ err: error }, 'Error fetching course for adminTitle')
      data.adminTitle = chapterTitle
    }
  } else {
    // No course relationship, use chapter title only
    data.adminTitle = chapterTitle
  }

  return data
}
