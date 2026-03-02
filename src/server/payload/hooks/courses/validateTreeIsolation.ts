/**
 * Publish-time course tree isolation hook
 *
 * Validates that all chapters reference this course when publishing.
 * Draft saves are not blocked.
 */
import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'
import { validateCourseTreeIsolation } from '@/server/services/course-tree-isolation'

export const validateTreeIsolationOnPublish: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  // Only validate when status is changing to 'published'
  const isPublishing = data?.status === 'published' && originalDoc?.status !== 'published'
  if (!isPublishing) return data

  const courseId = operation === 'update' ? originalDoc?.id : undefined
  if (!courseId) return data

  const result = await validateCourseTreeIsolation(req.payload, courseId)
  if (!result.valid) {
    throw new APIError(
      `Cannot publish course: tree isolation violation. ${result.errors.join('; ')}`,
      400,
    )
  }

  return data
}
