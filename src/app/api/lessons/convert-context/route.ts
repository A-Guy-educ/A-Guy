/**
 * Lesson Context Conversion API
 *
 * POST /api/lessons/convert-context
 * Extracts context text from a lesson content file using AI and stores in ContextExtractions collection
 */
import { ApiErrors, apiSuccess } from '@/server/api/responses'
import { withApiHandler } from '@/server/api/with-api-handler'
import { extractLessonContext } from '@/server/services/lesson-context-conversion/extract-context'
import { z } from 'zod'

// Request schema
const convertContextSchema = z.object({
  lessonId: z.string().min(1, 'lessonId is required'),
  promptId: z.string().min(1, 'promptId is required'),
  mediaId: z.string().min(1, 'mediaId is required'),
  mode: z.enum(['replace', 'append']).default('replace'),
})

type ConvertContextBody = z.infer<typeof convertContextSchema>

// POST handler
export const POST = withApiHandler<ConvertContextBody, unknown>(
  {
    auth: 'admin',
    bodySchema: convertContextSchema,
  },
  async ({ payload, user, body }) => {
    const { lessonId, promptId, mediaId, mode } = body

    // Call the extraction service (user is guaranteed non-null by auth: 'admin')
    const result = await extractLessonContext(payload, user!, {
      lessonId,
      promptId,
      mediaId,
      mode,
    })

    if (!result.success) {
      return ApiErrors.internal(result.error || 'Failed to extract context')
    }

    return apiSuccess({
      updatedContextText: result.updatedContextText,
      extractedChunkLength: result.extractedChunkLength,
      warnings: result.warnings,
    })
  },
)
