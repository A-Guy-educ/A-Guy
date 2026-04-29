/**
 * Create Exercises from Context API
 *
 * POST /api/lessons/create-context-exercises
 * Reads the latest ContextExtraction for the lesson and creates Exercise
 * documents with LaTeX blocks. Prefers the structured `exercises` array
 * produced by schema-mode extraction; falls back to regex-parsing the
 * `text` field for legacy extractions that have no structured payload.
 *
 * Idempotent: deletes previous context_extraction exercises before creating new ones,
 * and reconciles lesson.blocks (drops stale refs, appends new exerciseRef entries).
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

interface CreatableExercise {
  number: number
  title?: string
  latexContent: string
  solution: string | null
}

function isStructuredExercise(value: unknown): value is {
  number: number
  latex: string
  solution?: string | null
} {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.number !== 'number') return false
  if (typeof v.latex !== 'string') return false
  return true
}

interface StructuredReadResult {
  exercises: CreatableExercise[]
  skipped: number
}

function readStructuredExercises(extraction: unknown): StructuredReadResult | null {
  const value = (extraction as { exercises?: unknown })?.exercises
  if (!Array.isArray(value)) return null
  const valid: CreatableExercise[] = []
  let skipped = 0
  for (const entry of value) {
    if (!isStructuredExercise(entry) || !entry.latex.trim()) {
      skipped++
      continue
    }
    valid.push({
      number: entry.number,
      latexContent: entry.latex,
      solution: typeof entry.solution === 'string' && entry.solution.trim() ? entry.solution : null,
    })
  }
  return valid.length > 0 ? { exercises: valid, skipped } : null
}

type LessonBlock = {
  id: string
  blockType: 'exerciseRef' | 'contentPageRef'
  exercise?: string | { id: string }
  contentPage?: string | { id: string }
}

function generateBlockId(): string {
  return Math.random().toString(36).slice(2, 14)
}

function parseLessonBlocks(value: unknown): LessonBlock[] {
  if (Array.isArray(value)) return value as LessonBlock[]
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed as LessonBlock[]
    } catch {
      // ignore
    }
  }
  return []
}

function extractRefId(val: unknown): string | null {
  if (typeof val === 'string' && val.length > 0) return val
  if (val && typeof val === 'object' && 'id' in val) return String((val as { id: unknown }).id)
  return null
}

export const POST = withApiHandler<CreateContextExercisesBody, unknown>(
  {
    auth: 'admin',
    bodySchema: createContextExercisesSchema,
  },
  async ({ payload, body, user }) => {
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

    const extractionDoc = extractionResult.docs[0] as unknown as {
      text: string
      exercises?: unknown
    }

    // Prefer the structured exercises array from schema-mode extraction.
    // Fall back to regex-parsing the rendered text for legacy extractions.
    const structured = readStructuredExercises(extractionDoc)
    let allExercises: CreatableExercise[] | null = structured?.exercises ?? null
    let source: 'structured' | 'legacy_text' = 'structured'
    const warnings: string[] = []

    if (structured && structured.skipped > 0) {
      // Surface partial corruption so admins don't silently lose exercises
      // when Gemini occasionally emits malformed entries inside an otherwise-
      // valid response.
      warnings.push(
        `Skipped ${structured.skipped} malformed entr${structured.skipped === 1 ? 'y' : 'ies'} in structured exercises — review the extraction in the viewer before publishing.`,
      )
    }

    if (!allExercises) {
      source = 'legacy_text'
      const extractionText = extractionDoc.text
      if (!extractionText?.trim()) {
        return apiError(
          'VALIDATION_ERROR',
          'Context extraction is empty. Run "Convert Context" again.',
          400,
        )
      }

      const segments = parseContextText(extractionText)
      const legacy = segments.flatMap((seg) =>
        seg.exercises.map((ex) => ({
          number: ex.number,
          title: ex.title,
          latexContent: ex.latexContent,
          solution: ex.solution,
        })),
      )
      if (legacy.length === 0) {
        return apiError('VALIDATION_ERROR', 'No exercises found in context text', 400)
      }
      allExercises = legacy
    }

    // Capture IDs of existing context_extraction exercises so we can drop their
    // stale references from lesson.blocks before re-appending the new ones.
    const staleResult = await payload.find({
      collection: 'exercises',
      where: {
        lesson: { equals: lessonId },
        origin: { equals: 'context_extraction' },
      },
      limit: 0,
      depth: 0,
    })
    const staleIds = new Set(staleResult.docs.map((doc) => String(doc.id)))

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

    // Reconcile lesson.blocks: strip stale exerciseRef entries pointing at the
    // exercises we just deleted, then append exerciseRefs for the newly-created
    // exercises so they show up in the Lesson admin's playlist.
    let lessonBlocksUpdated = false
    if (createdIds.length > 0 || staleIds.size > 0) {
      try {
        const lesson = await payload.findByID({
          collection: 'lessons',
          id: lessonId,
          depth: 0,
        })

        const existingBlocks = parseLessonBlocks((lesson as { blocks?: unknown }).blocks)

        const filteredBlocks = existingBlocks.filter((block) => {
          if (block.blockType !== 'exerciseRef') return true
          const refId = extractRefId(block.exercise)
          return refId === null || !staleIds.has(refId)
        })

        const appendedBlocks: LessonBlock[] = createdIds.map((exerciseId) => ({
          id: generateBlockId(),
          blockType: 'exerciseRef',
          exercise: exerciseId,
        }))

        const nextBlocks = [...filteredBlocks, ...appendedBlocks]

        await payload.update({
          collection: 'lessons',
          id: lessonId,
          data: { blocks: JSON.stringify(nextBlocks) } as Record<string, unknown>,
          user: user!,
          overrideAccess: false,
        })
        lessonBlocksUpdated = true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        warnings.push(`Failed to update lesson blocks: ${message}`)
      }
    }

    return apiSuccess({
      exerciseIds: createdIds,
      exerciseCount: createdIds.length,
      source,
      lessonBlocksUpdated,
      warnings: warnings.length > 0 ? warnings : undefined,
    })
  },
)
