/**
 * POST /api/lessons/convert-full-media
 *
 * One-button "Full Convert (Media)" path: runs Stage 1 (Gemini schema-mode
 * extraction) + Stage 2 (create exercises) + Stage 3 (convert each LaTeX
 * block to typed blocks) sequentially. Returns counts so the UI can show
 * a single status line instead of three.
 */
import { apiError, apiSuccess } from '@/server/api/responses'
import { withApiHandler } from '@/server/api/with-api-handler'
import { runFullMediaPipeline } from '@/server/services/lesson-context-conversion/full-pipeline'
import { z } from 'zod'

const bodySchema = z.object({
  lessonId: z.string().min(1),
  mediaId: z.string().min(1),
  promptId: z.string().min(1),
})

type Body = z.infer<typeof bodySchema>

export const POST = withApiHandler<Body, unknown>(
  {
    auth: 'admin',
    bodySchema,
  },
  async ({ payload, body, user }) => {
    const result = await runFullMediaPipeline({
      payload,
      user: user!,
      lessonId: body.lessonId,
      mediaId: body.mediaId,
      promptId: body.promptId,
    })

    if (!result.success) {
      return apiError('UPSTREAM_ERROR', result.error || 'Full media conversion failed', 400)
    }

    return apiSuccess({
      exerciseCount: result.exerciseCount,
      exerciseIds: result.exerciseIds,
      latexBlocksConverted: result.latexBlocksConverted,
      latexBlocksFailed: result.latexBlocksFailed,
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    })
  },
)
