/**
 * Context Extraction API
 *
 * GET  /api/lessons/context-extraction?lessonId=xxx
 *   Returns the latest context extraction text for a lesson.
 *
 * PUT  /api/lessons/context-extraction
 *   Updates the extraction text (used by ContextExerciseViewer for inline edits).
 */
import { apiSuccess } from '@/server/api/responses'
import { withApiHandler } from '@/server/api/with-api-handler'
import { z } from 'zod'

// GET — fetch extraction text for a lesson
const getQuerySchema = z.object({
  lessonId: z.string().min(1, 'lessonId is required'),
})

type GetQuery = z.infer<typeof getQuerySchema>

export const GET = withApiHandler<unknown, GetQuery>(
  {
    auth: 'admin',
    querySchema: getQuerySchema,
  },
  async ({ payload, query }) => {
    const { lessonId } = query

    const result = await payload.find({
      collection: 'context-extractions',
      where: { lesson: { equals: lessonId } },
      sort: '-updatedAt',
      limit: 1,
      depth: 0,
    })

    if (result.docs.length === 0) {
      return apiSuccess({ text: null, extractionId: null })
    }

    const doc = result.docs[0]
    return apiSuccess({
      text: (doc as unknown as { text: string }).text,
      extractionId: doc.id,
    })
  },
)

// PUT — update extraction text (inline edits from ContextExerciseViewer)
const putBodySchema = z.object({
  extractionId: z.string().min(1, 'extractionId is required'),
  text: z.string().min(1, 'text is required').max(200_000),
})

type PutBody = z.infer<typeof putBodySchema>

export const PUT = withApiHandler<PutBody>(
  {
    auth: 'admin',
    bodySchema: putBodySchema,
  },
  async ({ payload, body, user }) => {
    const { extractionId, text } = body

    // Invalidate the structured `exercises` snapshot so Stage 2
    // (create-context-exercises) falls back to re-parsing the edited text.
    // Without this, schema-mode extractions would silently ignore inline
    // viewer edits because Stage 2 prefers the unchanged exercises array.
    await payload.update({
      collection: 'context-extractions',
      id: extractionId,
      data: { text, exercises: null },
      user: user!,
      overrideAccess: false,
    })

    return apiSuccess({ updated: true })
  },
)
