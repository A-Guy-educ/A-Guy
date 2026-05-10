/**
 * Lesson Duplication Record API
 *
 * GET /api/lesson-duplications/:id/record
 *
 * Returns the full LessonDuplications document with resolved relationships.
 * Used by the LessonDuplicationReview admin component.
 *
 * Access: admin only.
 */
import { withApiHandler } from '@/server/api/with-api-handler'
import { apiSuccess, ApiErrors } from '@/server/api/responses'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const GET = withApiHandler<unknown, unknown>({ auth: 'admin' }, async ({ request }) => {
  const payload = await getPayload({ config: configPromise })

  // Extract id from route: /api/lesson-duplications/:id/record
  const url = new URL(request.url || 'http://localhost')
  const match = url.pathname.match(/\/lesson-duplications\/([^/]+)\/record/)
  const duplicationId = match?.[1]
  if (!duplicationId) {
    return ApiErrors.notFound('duplication id')
  }

  const record = await payload.findByID({
    collection: 'lesson-duplications',
    id: duplicationId,
    depth: 2, // resolve sourceLesson, outputLesson
    overrideAccess: false,
  })
  if (!record) return ApiErrors.notFound('LessonDuplications record')

  return apiSuccess(record)
})
