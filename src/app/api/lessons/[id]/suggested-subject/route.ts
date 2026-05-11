/**
 * Suggested Subject API
 *
 * GET /api/lessons/:id/suggested-subject
 *
 * Returns a suggested `DuplicationSubject` for a lesson, derived from the
 * blocks of its exercises. Used by the lesson duplicate modal to pre-fill
 * the subject radio before the admin submits.
 *
 * @fileType api-route
 * @domain lesson-duplication
 * @pattern subject-detection
 * @ai-summary Reads a lesson's exercises and guesses subject by block types.
 *
 * Access: admin only.
 */
import { withApiHandler } from '@/server/api/with-api-handler'
import { apiSuccess, ApiErrors } from '@/server/api/responses'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import {
  detectLessonSubject,
  type ExerciseLikeBlocks,
} from '@/server/services/lesson-duplication/subject-detector'

export const GET = withApiHandler<unknown, unknown>({ auth: 'admin' }, async ({ request }) => {
  const payload = await getPayload({ config: configPromise })

  // Extract id from route: /api/lessons/:id/suggested-subject
  const url = new URL(request.url || 'http://localhost')
  const match = url.pathname.match(/\/lessons\/([^/]+)\/suggested-subject/)
  const lessonId = match?.[1]
  if (!lessonId) {
    return ApiErrors.notFound('lesson id')
  }

  // Verify the lesson exists (so we return 404 instead of an empty 200).
  try {
    await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return ApiErrors.notFound(`Lesson "${lessonId}"`)
  }

  // Fetch every exercise that belongs to the lesson. depth=0 keeps the payload small;
  // we only need `content.blocks` for detection.
  const exercises = await payload.find({
    collection: 'exercises',
    where: { lesson: { equals: lessonId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })

  const subject = detectLessonSubject(exercises.docs as unknown as ExerciseLikeBlocks[])

  return apiSuccess({ lessonId, subject, exerciseCount: exercises.docs.length })
})
