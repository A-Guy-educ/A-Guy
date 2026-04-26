/**
 * POST /api/exercises/import-latex
 * Import exercises from LaTeX source using the latex-parser library.
 *
 * Splits on \textbf{תרגיל N} boundaries and creates one exercise per question.
 * If no exercise titles are found, creates a single exercise with all blocks.
 *
 * Access: Authenticated users only
 */
import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import { parseLatexToExercises } from '@/lib/latex-parser'
import { logger } from '@/infra/utils/logger'

const ImportLatexSchema = z.object({
  latex: z.string().min(1).max(500_000),
  lessonId: z.string().min(1),
})

export async function importExerciseFromLatex(req: PayloadRequest): Promise<Response> {
  if (!req.user) {
    return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const body = (req as PayloadRequest & { json?: unknown }).json
  const parsed = ImportLatexSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ success: false, error: parsed.error.message }, { status: 400 })
  }

  const { latex, lessonId } = parsed.data
  const reqLogger = logger.child({ requestId: crypto.randomUUID() })

  try {
    await req.payload.findByID({ collection: 'lessons', id: lessonId })
  } catch {
    return Response.json({ success: false, error: 'Lesson not found' }, { status: 404 })
  }

  const result = parseLatexToExercises(latex)

  if (result.errors.length > 0) {
    reqLogger.warn({ errors: result.errors }, 'LaTeX import had errors')
    return Response.json({ success: false, errors: result.errors }, { status: 422 })
  }

  if (result.exercises.length === 0) {
    return Response.json({ success: false, error: 'No parseable content found' }, { status: 422 })
  }

  try {
    const existing = await req.payload.find({
      collection: 'exercises',
      where: { lesson: { equals: lessonId } },
      limit: 0,
    })
    const startOrder = existing.totalDocs

    const createdIds: string[] = []

    for (let i = 0; i < result.exercises.length; i++) {
      const group = result.exercises[i]
      const exercise = await req.payload.create({
        collection: 'exercises',
        data: {
          lesson: lessonId,
          title: group.title || undefined,
          content: { blocks: group.blocks },
          origin: 'import',
          order: startOrder + i,
          sourceLatex: latex,
        },
        draft: true,
      })
      createdIds.push(exercise.id)
    }

    reqLogger.info({ lessonId, count: createdIds.length }, 'Exercises created from LaTeX import')

    return Response.json({
      success: true,
      data: {
        exerciseIds: createdIds,
        exerciseCount: createdIds.length,
        warnings: result.warnings,
      },
    })
  } catch (err) {
    reqLogger.error({ err }, 'Failed to save exercises from LaTeX import')
    const message = err instanceof Error ? err.message : 'Failed to save exercises'
    return Response.json({ success: false, error: message }, { status: 422 })
  }
}
