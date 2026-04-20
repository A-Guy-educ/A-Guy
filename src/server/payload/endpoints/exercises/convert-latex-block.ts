/**
 * POST /api/exercises/convert-latex-block
 *
 * In-place conversion: if an exercise has one or more `{type:'latex'}` blocks,
 * parse each block's LaTeX via the deterministic script parser and replace the
 * original LaTeX block with the parsed structured blocks — same exercise, same
 * unit, content fleshed out.
 *
 * Fallback (V1-259): when the script parser produces zero usable blocks for a
 * LaTeX block AND fallback is enabled, the AI import route is called internally.
 * The AI route creates temp exercises; we harvest their blocks, apply them to
 * this exercise, then delete the temps.
 *
 * Access: Authenticated users only.
 */
import type { PayloadRequest } from 'payload'
import { parseLatexToBlocks } from '@/lib/latex-parser'
import { isSolutionHeader } from '@/lib/latex-parser/enumerate-parser'
import { logger } from '@/infra/utils/logger'
import { getConfigValueByKey } from '@/infra/config/runtime'
import { ConfigDomain } from '@/infra/config/config-constants'
import type { ContentBlock, LatexBlock } from '@/server/payload/collections/Exercises/types'

type ImportMethod = 'script' | 'ai_fallback'

interface ConversionOutcome {
  replacedBlockIds: string[]
  addedBlockCount: number
  method: ImportMethod
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
      req: { payload: req.payload, user: req.user } as never,
    })
  } catch {
    return Response.json({ success: false, error: 'Exercise not found' }, { status: 404 })
  }

  const lessonId =
    typeof exercise.lesson === 'string' ? exercise.lesson : (exercise.lesson as { id: string })?.id

  const blocks = (exercise.content as { blocks?: ContentBlock[] } | null)?.blocks ?? []
  const latexBlockIndices = blocks
    .map((b, i) => (b.type === 'latex' ? i : -1))
    .filter((i) => i !== -1)

  if (latexBlockIndices.length === 0) {
    return Response.json(
      { success: false, error: 'Exercise has no LaTeX block to convert' },
      { status: 422 },
    )
  }

  const nextBlocks: ContentBlock[] = [...blocks]
  const outcome: ConversionOutcome = {
    replacedBlockIds: [],
    addedBlockCount: 0,
    method: 'script',
    warnings: [],
    errors: [],
  }
  const sourceLatexChunks: string[] = []

  // Pre-scan: identify which LaTeX blocks are solution blocks.
  // Solution blocks will be combined with their preceding exercise block
  // when sent to the AI, so the AI can place solutions in the `solution` field.
  const solutionBlockIndices = new Set<number>()
  for (const idx of latexBlockIndices) {
    const lb = blocks[idx] as LatexBlock
    const firstLine =
      lb.latex
        .trim()
        .split('\n')
        .find((l) => l.trim().length > 0) || ''
    if (isSolutionHeader(firstLine)) {
      solutionBlockIndices.add(idx)
    }
  }

  // Build a map: exercise block index → combined LaTeX (exercise + following solution)
  const combinedLatexForAI = new Map<number, string>()
  for (const idx of latexBlockIndices) {
    if (solutionBlockIndices.has(idx)) continue // skip solution blocks
    const exerciseLatex = (blocks[idx] as LatexBlock).latex
    // Check if the next block is a solution block
    const nextIdx = latexBlockIndices[latexBlockIndices.indexOf(idx) + 1]
    if (nextIdx !== undefined && solutionBlockIndices.has(nextIdx)) {
      const solutionLatex = (blocks[nextIdx] as LatexBlock).latex
      combinedLatexForAI.set(idx, `${exerciseLatex}\n\n${solutionLatex}`)
    }
  }

  // Iterate right-to-left so splice indices stay valid as we mutate nextBlocks.
  for (let i = latexBlockIndices.length - 1; i >= 0; i--) {
    const idx = latexBlockIndices[i]
    const latexBlock = blocks[idx] as LatexBlock

    // Solution blocks: remove them — their content was combined with the
    // preceding exercise block for AI processing.
    if (solutionBlockIndices.has(idx)) {
      outcome.replacedBlockIds.push(latexBlock.id)
      nextBlocks.splice(idx, 1)
      continue
    }

    // --- Attempt 1: script parser (exercise block only, no solution) ---
    const result = parseLatexToBlocks(latexBlock.latex)
    outcome.warnings.push(...result.warnings)
    outcome.errors.push(...result.errors)

    const scriptUsable =
      result.blocks.length > 0 &&
      result.errors.length === 0 &&
      isScriptOutputMeaningful(latexBlock.latex, result.blocks)

    if (scriptUsable) {
      // Script succeeded with meaningful output
      outcome.replacedBlockIds.push(latexBlock.id)
      outcome.addedBlockCount += result.blocks.length
      sourceLatexChunks.unshift(latexBlock.latex)

      // If there's a paired solution block, attach its content to
      // the question blocks' `solution` field.
      const solutionLatex = combinedLatexForAI.has(idx)
        ? (blocks[latexBlockIndices[latexBlockIndices.indexOf(idx) + 1]] as LatexBlock).latex
        : null
      if (solutionLatex) {
        attachSolutionToBlocks(result.blocks, solutionLatex)
      }

      nextBlocks.splice(idx, 1, ...result.blocks)
      continue
    }

    // --- Attempt 2: AI fallback (with solution content included) ---
    reqLogger.info(
      {
        blockId: latexBlock.id,
        scriptErrors: result.errors.length,
        scriptBlocks: result.blocks.length,
        scriptUsable,
        hasSolutionBlock: combinedLatexForAI.has(idx),
      },
      'Script parser output not usable, checking AI fallback',
    )

    const fallbackEnabled = await isFallbackEnabled()
    if (!fallbackEnabled) {
      reqLogger.warn({ blockId: latexBlock.id }, 'AI fallback disabled — leaving block untouched')
      continue
    }

    if (!lessonId) {
      reqLogger.warn('Cannot run AI fallback — exercise has no linked lesson')
      continue
    }

    // Send combined exercise+solution LaTeX to AI so it can place
    // solutions in the question blocks' `solution` field.
    const latexForAI = combinedLatexForAI.get(idx) || latexBlock.latex
    const aiBlocks = await tryAiFallback(req, latexForAI, lessonId, reqLogger)
    if (aiBlocks && aiBlocks.length > 0) {
      outcome.method = 'ai_fallback'
      outcome.replacedBlockIds.push(latexBlock.id)
      outcome.addedBlockCount += aiBlocks.length
      sourceLatexChunks.unshift(latexBlock.latex)
      nextBlocks.splice(idx, 1, ...aiBlocks)

      emitFallbackAnalytics(req, { lessonId, exerciseId, scriptErrors: result.errors.length })
    } else {
      reqLogger.warn(
        { blockId: latexBlock.id },
        'AI fallback also failed — leaving block untouched',
      )
    }
  }

  if (outcome.replacedBlockIds.length === 0) {
    return Response.json(
      {
        success: false,
        error: 'No LaTeX block could be parsed (script and AI both failed)',
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
      overrideAccess: true,
      req: { payload: req.payload, user: req.user } as never,
    })

    reqLogger.info(
      {
        method: outcome.method,
        replaced: outcome.replacedBlockIds.length,
        added: outcome.addedBlockCount,
        totalBlocks: nextBlocks.length,
      },
      'LaTeX block(s) converted in place',
    )

    return Response.json({
      success: true,
      method: outcome.method,
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

// ---------------------------------------------------------------------------
// AI Fallback: call the existing AI import route, harvest blocks, delete temps
// ---------------------------------------------------------------------------

async function tryAiFallback(
  req: PayloadRequest,
  latex: string,
  lessonId: string,
  reqLogger: typeof logger,
): Promise<ContentBlock[] | null> {
  try {
    const origin = deriveOrigin(req)
    const cookie = req.headers?.get?.('cookie') || ''

    const aiResponse = await fetch(`${origin}/api/exercises/import-latex-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ latex, lessonId }),
    })

    if (!aiResponse.ok) {
      reqLogger.warn({ status: aiResponse.status }, 'AI import route returned non-OK')
      return null
    }

    const aiData = (await aiResponse.json()) as {
      success: boolean
      data?: { exerciseIds: string[]; exerciseCount: number }
    }

    if (!aiData.success || !aiData.data?.exerciseIds?.length) {
      return null
    }

    // Harvest blocks from the temp exercise(s) the AI route created.
    const allBlocks: ContentBlock[] = []
    const tempIds = aiData.data.exerciseIds

    for (const tempId of tempIds) {
      try {
        const tempExercise = await req.payload.findByID({
          collection: 'exercises',
          id: tempId,
          depth: 0,
          overrideAccess: true,
        })
        const tempContent = tempExercise.content as { blocks?: ContentBlock[] } | null
        if (tempContent?.blocks) {
          allBlocks.push(...tempContent.blocks)
        }
      } catch {
        reqLogger.warn({ tempId }, 'Could not read temp exercise from AI fallback')
      }
    }

    // Clean up temp exercises — they were scaffolding for this in-place conversion.
    for (const tempId of tempIds) {
      try {
        await req.payload.delete({
          collection: 'exercises',
          id: tempId,
          overrideAccess: true,
        })
      } catch {
        reqLogger.warn({ tempId }, 'Could not delete temp exercise from AI fallback')
      }
    }

    reqLogger.info(
      { tempExercises: tempIds.length, harvestedBlocks: allBlocks.length },
      'AI fallback produced blocks',
    )

    return allBlocks.length > 0 ? allBlocks : null
  } catch (err) {
    reqLogger.error({ err }, 'AI fallback threw unexpectedly')
    return null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function isFallbackEnabled(): Promise<boolean> {
  try {
    const value = await getConfigValueByKey<boolean | string | undefined>(
      ConfigDomain.LatexConversion,
      'fallback_enabled',
      { defaultValue: true, throwIfNotFound: false },
    )
    if (value === false || value === 'false') return false
    return true
  } catch {
    return true // fail open
  }
}

function deriveOrigin(req: PayloadRequest): string {
  try {
    if (req.url) {
      const u = new URL(req.url)
      return `${u.protocol}//${u.host}`
    }
  } catch {
    // fall through
  }
  return process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
}

/**
 * Sanity-check that the script parser produced meaningful output.
 * If the total text content of all parsed blocks is tiny compared to the
 * source LaTeX, the parser likely dropped most of the content and we should
 * fall through to AI instead of persisting garbage.
 */
function isScriptOutputMeaningful(sourceLatex: string, parsedBlocks: ContentBlock[]): boolean {
  const totalContent = parsedBlocks
    .map((b) => {
      if ('value' in b && typeof b.value === 'string') return b.value
      if ('latex' in b && typeof b.latex === 'string') return b.latex
      return ''
    })
    .join('')

  // If source is non-trivial but output captured less than 10% of it, it's garbage.
  if (sourceLatex.length > 50 && totalContent.length < sourceLatex.length * 0.1) {
    return false
  }

  // If output is under 10 chars total regardless, it's garbage.
  if (totalContent.length < 10) {
    return false
  }

  return true
}

/**
 * Attach solution LaTeX content to the question blocks' `solution` field.
 * Finds all question blocks and distributes the solution text.
 * For a single question, the entire solution goes to it.
 * For multiple questions, the full solution is attached to the last one
 * (most solutions are a single block covering all sub-questions).
 */
function attachSolutionToBlocks(blocks: ContentBlock[], solutionLatex: string): void {
  // Clean solution: strip the header line, keep the content
  const lines = solutionLatex.split('\n')
  const firstLine = lines.find((l) => l.trim().length > 0) || ''
  const contentWithoutHeader = isSolutionHeader(firstLine)
    ? lines
        .slice(lines.indexOf(firstLine) + 1)
        .join('\n')
        .trim()
    : solutionLatex.trim()

  if (!contentWithoutHeader) return

  // Find question blocks
  const questionIndices: number[] = []
  for (let i = 0; i < blocks.length; i++) {
    const t = blocks[i].type
    if (
      t === 'question_free_response' ||
      t === 'question_select' ||
      t === 'question_table' ||
      t === 'question_axis' ||
      t === 'question_geometry'
    ) {
      questionIndices.push(i)
    }
  }

  if (questionIndices.length === 0) return

  // Attach to the last question block (covers the common case of
  // one solution covering all sub-questions)
  const lastIdx = questionIndices[questionIndices.length - 1]
  const qBlock = blocks[lastIdx] as ContentBlock & {
    solution?: { type: string; format: string; value: string; mediaIds: string[] }
  }
  qBlock.solution = {
    type: 'rich_text',
    format: 'md-math-v1',
    value: contentWithoutHeader,
    mediaIds: [],
  }
}

function emitFallbackAnalytics(
  req: PayloadRequest,
  props: { lessonId: string; exerciseId: string; scriptErrors: number },
): void {
  logger.info(
    {
      event: 'latex_import_fallback',
      lessonId: props.lessonId,
      exerciseId: props.exerciseId,
      scriptErrors: props.scriptErrors,
      userId: req.user?.id,
    },
    'latex_import_fallback',
  )
}
