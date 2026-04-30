/**
 * POST /api/lessons/convert-full-latex
 *
 * One-button "Full Convert (LaTeX)" path: reads a .tex file attached to
 * the lesson, splits it into exercises with the deterministic parser
 * (no Gemini), creates Exercise documents, and runs the LaTeX → typed
 * block conversion on each. The Gemini AI fallback inside Stage 3 is
 * still available for blocks the deterministic parser can't handle.
 */
import { apiError, apiSuccess } from '@/server/api/responses'
import { withApiHandler } from '@/server/api/with-api-handler'
import { runFullLatexPipeline } from '@/server/services/lesson-context-conversion/full-pipeline'
import { z } from 'zod'

const bodySchema = z.object({
  lessonId: z.string().min(1),
  mediaId: z.string().min(1),
})

type Body = z.infer<typeof bodySchema>

export const POST = withApiHandler<Body, unknown>(
  {
    auth: 'admin',
    bodySchema,
  },
  async ({ payload, body, user }) => {
    const result = await runFullLatexPipeline({
      payload,
      user: user!,
      lessonId: body.lessonId,
      mediaId: body.mediaId,
    })

    if (!result.success) {
      return apiError('UPSTREAM_ERROR', result.error || 'Full LaTeX conversion failed', 400)
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
