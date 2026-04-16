/**
 * Create Exercises from Context API
 *
 * POST /api/lessons/create-context-exercises
 * Reads the latest ContextExtraction for the lesson, parses its LaTeX text
 * into individual exercises, and creates Exercise documents with LaTeX blocks.
 *
 * Idempotent: deletes previous context_extraction exercises before creating new ones.
 */
import { apiError, apiSuccess } from '@/server/api/responses'
import { withApiHandler } from '@/server/api/with-api-handler'
import { parseContextText } from '@/lib/context-exercise-parser'
import { makeLatexBlock } from '@/lib/latex-parser/block-generators'
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
  async ({ payload, body }) => {
    const { lessonId } = body

    // Fetch the latest context extraction for this lesson
    const extractionResult = await payload.find({
      collection: 'context-extractions',
      where: { lesson: { equals: lessonId } },
      sort: '-updatedAt',
      limit: 1,
      depth: 0,
    })

    if (extractionResult.docs.length === 0) {
      return apiError(
        'VALIDATION_ERROR',
        'No context extraction found for this lesson. Run "Convert Context" first.',
        400,
      )
    }

    const extractionText = (extractionResult.docs[0] as unknown as { text: string }).text

    if (!extractionText?.trim()) {
      return apiError(
        'VALIDATION_ERROR',
        'Context extraction is empty. Run "Convert Context" again.',
        400,
      )
    }

    // Parse into exercises
    const segments = parseContextText(extractionText)
    const allExercises = segments.flatMap((seg) => seg.exercises)

    if (allExercises.length === 0) {
      return apiError('VALIDATION_ERROR', 'No exercises found in context text', 400)
    }

    // Delete existing context_extraction exercises for this lesson (idempotent)
    await payload.delete({
      collection: 'exercises',
      where: {
        lesson: { equals: lessonId },
        origin: { equals: 'context_extraction' },
      },
    })

    // Get current exercise count for ordering
    const currentExercises = await payload.find({
      collection: 'exercises',
      where: { lesson: { equals: lessonId } },
      limit: 0,
    })
    const startOrder = currentExercises.totalDocs

    // Create exercises with LaTeX blocks
    const createdIds: string[] = []
    const warnings: string[] = []

    for (let i = 0; i < allExercises.length; i++) {
      const exercise = allExercises[i]
      const blocks = [makeLatexBlock(exercise.latexContent)]

      // If exercise has a solution, add it as a second LaTeX block
      if (exercise.solution) {
        blocks.push(makeLatexBlock(exercise.solution))
      }

      try {
        const created = await payload.create({
          collection: 'exercises',
          data: {
            lesson: lessonId,
            title: exercise.title || `תרגיל ${exercise.number}`,
            content: { blocks },
            origin: 'context_extraction',
            order: startOrder + i,
          },
          draft: true,
          context: { _skipBlockSync: true },
        })
        createdIds.push(created.id)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        warnings.push(`Failed to create exercise ${exercise.number}: ${message}`)
      }
    }

    return apiSuccess({
      exerciseIds: createdIds,
      exerciseCount: createdIds.length,
      warnings: warnings.length > 0 ? warnings : undefined,
    })
  },
)
