/**
 * POST /api/exercises/:id/convert-latex-block
 *
 * In-place conversion: if an exercise has one or more `{type:'latex'}` blocks,
 * parse each block's LaTeX via the deterministic script parser and replace the
 * original LaTeX block with the parsed structured blocks — same exercise, same
 * unit, content fleshed out.
 *
 * Notes:
 *  - Script parser only (no AI fallback yet). AI fallback here is a follow-up
 *    because the AI route currently wraps exercise-creation side-effects and
 *    would need a pure "latex → blocks" helper extracted first.
 *  - `sourceLatex` is populated with the concatenated original LaTeX so the
 *    upgrade is traceable back to its source content.
 *  - Surrounding non-LaTeX blocks in the exercise are preserved.
 *
 * Access: Authenticated users only.
 */
import type { PayloadRequest } from 'payload'
import { parseLatexToBlocks } from '@/lib/latex-parser'
import { logger } from '@/infra/utils/logger'
import type { ContentBlock, LatexBlock } from '@/server/payload/collections/Exercises/types'

interface ConversionOutcome {
  replacedBlockIds: string[]
  addedBlockCount: number
  warnings: { line: number; message: string; rawLatex: string }[]
  errors: { line: number; message: string; rawLatex: string }[]
}

export async function convertLatexBlockOnExercise(
  req: PayloadRequest,
  exerciseId: string,
): Promise<Response> {
  if (!req.user) {
    return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const reqLogger = logger.child({
    requestId: crypto.randomUUID(),
    feature: 'latex_block_convert',
    exerciseId,
  })

  // Fetch the exercise.
  let exercise
  try {
    exercise = await req.payload.findByID({
      collection: 'exercises',
      id: exerciseId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return Response.json({ success: false, error: 'Exercise not found' }, { status: 404 })
  }

  const blocks = (exercise.content as { blocks?: ContentBlock[] } | null)?.blocks ?? []
  const latexBlockIndices = blocks
    .map((b, i) => (b.type === 'latex' ? i : -1))
    .filter((i) => i !== -1)

  if (latexBlockIndices.length === 0) {
    return Response.json(
      {
        success: false,
        error: 'Exercise has no LaTeX block to convert',
      },
      { status: 422 },
    )
  }

  // Parse each LaTeX block and splice structured blocks in at its index.
  const nextBlocks: ContentBlock[] = [...blocks]
  const outcome: ConversionOutcome = {
    replacedBlockIds: [],
    addedBlockCount: 0,
    warnings: [],
    errors: [],
  }
  const sourceLatexChunks: string[] = []

  // Iterate right-to-left so splice indices stay valid as we mutate nextBlocks.
  for (let i = latexBlockIndices.length - 1; i >= 0; i--) {
    const idx = latexBlockIndices[i]
    const latexBlock = blocks[idx] as LatexBlock
    const result = parseLatexToBlocks(latexBlock.latex)

    outcome.warnings.push(...result.warnings)
    outcome.errors.push(...result.errors)

    if (result.errors.length > 0 || result.blocks.length === 0) {
      reqLogger.warn(
        {
          blockId: latexBlock.id,
          errorCount: result.errors.length,
          producedBlocks: result.blocks.length,
        },
        'Script parser could not expand LaTeX block — leaving original in place',
      )
      // Leave this block untouched; continue with the next.
      continue
    }

    outcome.replacedBlockIds.push(latexBlock.id)
    outcome.addedBlockCount += result.blocks.length
    sourceLatexChunks.unshift(latexBlock.latex) // preserve document order
    nextBlocks.splice(idx, 1, ...result.blocks)
  }

  if (outcome.replacedBlockIds.length === 0) {
    return Response.json(
      {
        success: false,
        error: 'No LaTeX block could be parsed',
        errors: outcome.errors,
        warnings: outcome.warnings,
      },
      { status: 422 },
    )
  }

  // Persist updated content and sourceLatex.
  const combinedSourceLatex = sourceLatexChunks.join('\n\n% --- %\n\n')
  try {
    const updated = await req.payload.update({
      collection: 'exercises',
      id: exerciseId,
      data: {
        content: { blocks: nextBlocks as never },
        sourceLatex: combinedSourceLatex,
      },
      draft: true,
      overrideAccess: true, // Auth already checked at route level; we intentionally change structure
    })

    reqLogger.info(
      {
        replaced: outcome.replacedBlockIds.length,
        added: outcome.addedBlockCount,
        totalBlocks: nextBlocks.length,
      },
      'LaTeX block(s) converted in place',
    )

    return Response.json({
      success: true,
      data: {
        exerciseId: updated.id,
        replacedBlockIds: outcome.replacedBlockIds,
        addedBlockCount: outcome.addedBlockCount,
        totalBlocks: nextBlocks.length,
        warnings: outcome.warnings,
      },
    })
  } catch (err) {
    reqLogger.error({ err }, 'Failed to persist exercise after LaTeX block conversion')
    const message = err instanceof Error ? err.message : 'Failed to save exercise'
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
