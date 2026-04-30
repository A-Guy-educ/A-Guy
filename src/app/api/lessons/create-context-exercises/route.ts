/**
 * Create Exercises from Context API
 *
 * POST /api/lessons/create-context-exercises
 * Thin wrapper over createExercisesFromExtraction. Used by the Steps
 * Convert flow (admin manually clicks "Create Exercises" in the viewer).
 * The two full-pipeline endpoints (convert-full-media, convert-full-latex)
 * call the service directly.
 */
import { apiError, apiSuccess } from '@/server/api/responses'
import { withApiHandler } from '@/server/api/with-api-handler'
import { createExercisesFromExtraction } from '@/server/services/lesson-context-conversion/create-exercises-from-extraction'
import { z } from 'zod'

const createContextExercisesSchema = z.object({
  lessonId: z.string().min(1, 'lessonId is required'),
})

type CreateContextExercisesBody = z.infer<typeof createContextExercisesSchema>

export const POST = withApiHandler<CreateContextExercisesBody, unknown>(
  {
    auth: 'admin',
    bodySchema: createContextExercisesSchema,
  },
  async ({ payload, body, user }) => {
    const { lessonId } = body

    const result = await createExercisesFromExtraction({
      payload,
      user: user!,
      lessonId,
    })

    if ('error' in result) {
      return apiError('VALIDATION_ERROR', result.error.message, 400)
    }

    return apiSuccess({
      exerciseIds: result.exerciseIds,
      exerciseCount: result.exerciseCount,
      source: result.source,
      lessonBlocksUpdated: result.lessonBlocksUpdated,
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    })
  },
)
