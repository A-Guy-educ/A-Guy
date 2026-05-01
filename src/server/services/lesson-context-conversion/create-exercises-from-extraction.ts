/**
 * Stage 2 of the conversion pipeline as a reusable service.
 *
 * Reads the latest ContextExtraction for a lesson and creates Exercise
 * documents with LaTeX blocks. Prefers the structured `exercises` array
 * (schema-mode extraction) and falls back to regex-parsing the rendered
 * `text` for legacy or text-mode extractions.
 *
 * Idempotent: deletes prior origin='context_extraction' exercises before
 * recreating, and reconciles lesson.blocks (drops stale refs, appends
 * fresh exerciseRef entries).
 *
 * Used by:
 *   - POST /api/lessons/create-context-exercises (Steps Convert)
 *   - runFullMediaPipeline (Full Convert (Media))
 *   - runFullLatexPipeline (Full Convert (LaTeX))
 */
import type { Payload, User } from 'payload'
import { parseContextText } from '@/lib/context-exercise-parser'
import { makeLatexBlock } from '@/lib/latex-parser/block-generators'

export interface CreateExercisesInput {
  payload: Payload
  user: User
  lessonId: string
}

export interface CreateExercisesResult {
  exerciseIds: string[]
  exerciseCount: number
  source: 'structured' | 'legacy_text'
  lessonBlocksUpdated: boolean
  warnings: string[]
}

export type CreateExercisesError = {
  code: 'NO_EXTRACTION' | 'EMPTY_EXTRACTION' | 'NO_EXERCISES'
  message: string
}

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

function readStructuredExercises(
  extraction: unknown,
): { exercises: CreatableExercise[]; skipped: number } | null {
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

export async function createExercisesFromExtraction(
  input: CreateExercisesInput,
): Promise<CreateExercisesResult | { error: CreateExercisesError }> {
  const { payload, user, lessonId } = input

  const extractionResult = await payload.find({
    collection: 'context-extractions',
    where: { lesson: { equals: lessonId } },
    sort: '-updatedAt',
    limit: 1,
    depth: 0,
  })

  if (extractionResult.docs.length === 0) {
    return {
      error: {
        code: 'NO_EXTRACTION',
        message: 'No context extraction found for this lesson. Run "Convert Context" first.',
      },
    }
  }

  const extractionDoc = extractionResult.docs[0] as unknown as {
    text: string
    exercises?: unknown
  }

  const structured = readStructuredExercises(extractionDoc)
  let allExercises: CreatableExercise[] | null = structured?.exercises ?? null
  let source: 'structured' | 'legacy_text' = 'structured'
  const warnings: string[] = []

  if (structured && structured.skipped > 0) {
    warnings.push(
      `Skipped ${structured.skipped} malformed entr${structured.skipped === 1 ? 'y' : 'ies'} in structured exercises — review the extraction in the viewer before publishing.`,
    )
  }

  if (!allExercises) {
    source = 'legacy_text'
    const extractionText = extractionDoc.text
    if (!extractionText?.trim()) {
      return {
        error: {
          code: 'EMPTY_EXTRACTION',
          message: 'Context extraction is empty. Run "Convert Context" again.',
        },
      }
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
      return {
        error: {
          code: 'NO_EXERCISES',
          message: 'No exercises found in context text',
        },
      }
    }
    allExercises = legacy
  }

  // Capture stale ids before deletion so we can drop their lesson.blocks
  // references after recreating.
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

  await payload.delete({
    collection: 'exercises',
    where: {
      lesson: { equals: lessonId },
      origin: { equals: 'context_extraction' },
    },
  })

  const currentExercises = await payload.find({
    collection: 'exercises',
    where: { lesson: { equals: lessonId } },
    limit: 0,
  })
  const startOrder = currentExercises.totalDocs

  const createdIds: string[] = []

  for (let i = 0; i < allExercises.length; i++) {
    const exercise = allExercises[i]
    const blocks = [makeLatexBlock(exercise.latexContent)]

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
        user,
        overrideAccess: false,
      })
      lessonBlocksUpdated = true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      warnings.push(`Failed to update lesson blocks: ${message}`)
    }
  }

  return {
    exerciseIds: createdIds,
    exerciseCount: createdIds.length,
    source,
    lessonBlocksUpdated,
    warnings,
  }
}
