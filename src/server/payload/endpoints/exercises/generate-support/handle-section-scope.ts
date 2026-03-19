/**
 * Handle section-scope support generation (single block)
 */
import type { PayloadRequest } from 'payload'
import type { ContentData } from '@/server/payload/collections/Exercises/types'
import { generateSupport } from '@/infra/llm/services/support-generation-service'
import type { ParsedSupportInput } from './schema'
import { isQuestionBlock, applyGeneratedSupport } from './support-block-utils'

export async function handleSectionScope(
  req: PayloadRequest,
  input: ParsedSupportInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reqLogger: any,
) {
  if (!input.blockId) {
    return Response.json(
      { success: false, error: 'blockId is required for section scope' },
      { status: 400 },
    )
  }

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

  const block = content.blocks.find((b) => b.id === input.blockId)
  if (!block) {
    return Response.json({ success: false, error: 'Block not found' }, { status: 404 })
  }

  if (!isQuestionBlock(block)) {
    return Response.json({ success: false, error: 'Block is not a question type' }, { status: 400 })
  }

  const startTime = Date.now()
  reqLogger.info(
    { exerciseId: input.id, blockId: input.blockId },
    '[Support Generation] Starting section generation',
  )

  const result = await generateSupport(
    {
      block,
      exerciseTitle: exercise.title ?? undefined,
      targetFields: input.options.targetFields,
    },
    req.payload,
  )

  if (!result.success) {
    return Response.json({ success: false, error: result.error }, { status: 500 })
  }

  const updatedBlocks = content.blocks.map((b) => {
    if (b.id !== input.blockId) return b
    return applyGeneratedSupport(b, result.data!, input.options.overwrite)
  })

  await req.payload.update({
    collection: 'exercises',
    id: input.id,
    data: { content: { blocks: updatedBlocks } },
  })

  reqLogger.info(
    { exerciseId: input.id, blockId: input.blockId, durationMs: Date.now() - startTime },
    '[Support Generation] Section generation complete',
  )

  return Response.json({
    success: true,
    data: { generated: result.data, blockId: input.blockId },
  })
}
