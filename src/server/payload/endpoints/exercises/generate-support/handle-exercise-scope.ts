/**
 * Handle exercise-scope support generation (all blocks in one exercise)
 */
import type { PayloadRequest } from 'payload'
import type { ContentData } from '@/server/payload/collections/Exercises/types'
import { generateSupport } from '@/infra/llm/services/support-generation-service'
import type { ParsedSupportInput } from './schema'
import { isQuestionBlock, hasExistingSupport, applyGeneratedSupport } from './support-block-utils'

export async function handleExerciseScope(
  req: PayloadRequest,
  input: ParsedSupportInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reqLogger: any,
) {
  const exercise = await req.payload.findByID({
    collection: 'exercises',
    id: input.id,
  })

  if (!exercise) {
    return Response.json({ success: false, error: 'Exercise not found' }, { status: 404 })
  }

  const content = exercise.content as unknown as ContentData | undefined
  if (!content?.blocks) {
    return Response.json(
      { success: false, error: 'Exercise has no content blocks' },
      { status: 400 },
    )
  }

  const questionBlocks = content.blocks.filter(isQuestionBlock)
  if (questionBlocks.length === 0) {
    return Response.json({ success: false, error: 'No question blocks found' }, { status: 400 })
  }

  const startTime = Date.now()
  reqLogger.info(
    { exerciseId: input.id, blockCount: questionBlocks.length },
    '[Support Generation] Starting exercise generation',
  )

  const results: Array<{ blockId: string; success: boolean; error?: string }> = []
  const updatedBlocks = [...content.blocks]

  for (const block of questionBlocks) {
    if (!input.options.overwrite && hasExistingSupport(block)) {
      results.push({ blockId: block.id, success: true })
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
      results.push({ blockId: block.id, success: true })
    } else {
      results.push({ blockId: block.id, success: false, error: result.error })
    }
  }

  await req.payload.update({
    collection: 'exercises',
    id: input.id,
    data: { content: { blocks: updatedBlocks } },
  })

  reqLogger.info(
    {
      exerciseId: input.id,
      durationMs: Date.now() - startTime,
      totalBlocks: questionBlocks.length,
      succeeded: results.filter((r) => r.success).length,
    },
    '[Support Generation] Exercise generation complete',
  )

  return Response.json({
    success: true,
    data: { results, totalBlocks: questionBlocks.length },
  })
}
