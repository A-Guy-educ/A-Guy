/**
 * POST /api/exercises/import-latex
 * Import exercise from LaTeX source using the latex-parser library
 *
 * Access: Authenticated users only
 */
import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import { parseLatexToBlocks } from '@/lib/latex-parser'
import { logger } from '@/infra/utils/logger'

const ImportLatexSchema = z.object({
  latex: z.string().min(1).max(500_000),
  lessonId: z.string().min(1),
})

export async function importExerciseFromLatex(req: PayloadRequest): Promise<Response> {
  if (!req.user) {
    return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const body = await new Response(req.body).json()
  const parsed = ImportLatexSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ success: false, error: parsed.error.message }, { status: 400 })
  }

  const { latex, lessonId } = parsed.data
  const reqLogger = logger.child({ requestId: crypto.randomUUID() })

  try {
    await req.payload.findByID({
      collection: 'lessons',
      id: lessonId,
    })
  } catch {
    return Response.json({ success: false, error: 'Lesson not found' }, { status: 404 })
  }

  const result = parseLatexToBlocks(latex)

  if (result.errors.length > 0) {
    reqLogger.warn({ errors: result.errors }, 'LaTeX import had errors')
    return Response.json({ success: false, errors: result.errors }, { status: 422 })
  }

  if (result.blocks.length === 0) {
    return Response.json({ success: false, error: 'No parseable content found' }, { status: 422 })
  }

  const exercise = await req.payload.create({
    collection: 'exercises',
    data: {
      lesson: lessonId,
      content: { blocks: result.blocks },
      origin: 'import',
      order: 0,
    },
    draft: true,
  })

  reqLogger.info({ exerciseId: exercise.id }, 'Exercise created from LaTeX')

  return Response.json({
    success: true,
    data: { exerciseId: exercise.id, warnings: result.warnings },
  })
}
