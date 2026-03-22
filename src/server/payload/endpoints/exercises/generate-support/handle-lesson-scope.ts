/**
 * Handle lesson-scope support generation (all exercises in a lesson)
 */
import type { PayloadRequest } from 'payload'
import type { ContentData } from '@/server/payload/collections/Exercises/types'
import { generateSupport } from '@/infra/llm/services/support-generation-service'
import type { ParsedSupportInput } from './schema'
import { isQuestionBlock, hasExistingSupport, applyGeneratedSupport } from './support-block-utils'

export async function handleLessonScope(
  req: PayloadRequest,
  input: ParsedSupportInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reqLogger: any,
) {
  const lesson = await req.payload.findByID({
    collection: 'lessons',
    id: input.id,
  })

  if (!lesson) {
    return Response.json({ success: false, error: 'Lesson not found' }, { status: 404 })
  }

  const exercises = await req.payload.find({
    collection: 'exercises',
    where: { lesson: { equals: input.id } },
    limit: 100,
  })

  if (exercises.docs.length === 0) {
    return Response.json(
      { success: false, error: 'No exercises found for this lesson' },
      { status: 400 },
    )
  }

  const startTime = Date.now()
  reqLogger.info(
    { lessonId: input.id, exerciseCount: exercises.docs.length },
    '[Support Generation] Starting lesson batch generation',
  )

  const exerciseResults: Array<{
    exerciseId: string
    blocksProcessed: number
    blocksSucceeded: number
  }> = []

  for (const exercise of exercises.docs) {
    const content = exercise.content as unknown as ContentData | undefined
    if (!content?.blocks) {
      exerciseResults.push({
        exerciseId: exercise.id,
        blocksProcessed: 0,
        blocksSucceeded: 0,
      })
      continue
    }

    const questionBlocks = content.blocks.filter(isQuestionBlock)
    if (questionBlocks.length === 0) {
      exerciseResults.push({
        exerciseId: exercise.id,
        blocksProcessed: 0,
        blocksSucceeded: 0,
      })
      continue
    }

    const updatedBlocks = [...content.blocks]
    let succeeded = 0

    for (const block of questionBlocks) {
      if (!input.options.overwrite && hasExistingSupport(block)) {
        succeeded++
        continue
      }

      const result = await generateSupport(
        {
          block,
          exerciseTitle: exercise.title ?? undefined,
          targetFields: input.options.targetFields,
        },
        req.payload,
      )

      if (result.success && result.data) {
        const idx = updatedBlocks.findIndex((b) => b.id === block.id)
        if (idx !== -1) {
          updatedBlocks[idx] = applyGeneratedSupport(
            updatedBlocks[idx],
            result.data,
            input.options.overwrite,
          )
        }
        succeeded++
      }
    }

    await req.payload.update({
      collection: 'exercises',
      id: exercise.id,
      data: { content: { blocks: updatedBlocks } },
    })

    exerciseResults.push({
      exerciseId: exercise.id,
      blocksProcessed: questionBlocks.length,
      blocksSucceeded: succeeded,
    })
  }

  reqLogger.info(
    {
      lessonId: input.id,
      durationMs: Date.now() - startTime,
      exerciseCount: exercises.docs.length,
    },
    '[Support Generation] Lesson batch generation complete',
  )

  return Response.json({
    success: true,
    data: { exerciseResults, totalExercises: exercises.docs.length },
  })
}
