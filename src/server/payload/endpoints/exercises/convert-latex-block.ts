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
import { generateSupport } from '@/infra/llm/services/support-generation-service'
import {
  applyGeneratedSupport,
  isQuestionBlock,
} from '@/server/payload/endpoints/exercises/generate-support/support-block-utils'
import type {
  ContentBlock,
  InlineRichText,
  LatexBlock,
} from '@/server/payload/collections/Exercises/types'

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
    // No LaTeX blocks to convert. Check if there are question blocks missing
    // hints/solutions — if so, run the AI fill step on the existing blocks.
    // This makes re-clicking "Convert" useful for already-converted exercises:
    // it triggers AI generation for any sub-question still missing support content.
    const hasFillableBlocks = blocks.some((b) => {
      if (!isQuestionBlock(b)) return false
      const qb = b as ContentBlock & { hint?: InlineRichText; solution?: InlineRichText }
      return !qb.hint?.value || !qb.solution?.value
    })

    if (!hasFillableBlocks) {
      return Response.json(
        {
          success: false,
          error:
            'Exercise has no LaTeX block to convert and no question blocks need hints/solutions',
        },
        { status: 422 },
      )
    }

    reqLogger.info(
      'No LaTeX blocks but question blocks need hints/solutions — running AI fill only',
    )
    const fillBlocks: ContentBlock[] = [...blocks]
    await fillMissingSolutionsWithAI(fillBlocks, req.payload, reqLogger)

    try {
      const updated = await req.payload.update({
        collection: 'exercises',
        id: exerciseId,
        data: { content: { blocks: fillBlocks as never } },
        draft: true,
        overrideAccess: true,
        req: { payload: req.payload, user: req.user } as never,
      })
      return Response.json({
        success: true,
        method: 'ai_fill_only',
        data: {
          exerciseId: updated.id,
          replacedBlockIds: [],
          addedBlockCount: 0,
          totalBlocks: fillBlocks.length,
          warnings: [],
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save exercise'
      return Response.json({ success: false, error: message }, { status: 500 })
    }
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

  // Identify solution blocks. Two detection methods:
  // 1. Origin-based: exercises created by create-context-exercises (origin: 'context_extraction')
  //    always have [exercise block, solution block] — the last LaTeX block is the solution
  // 2. Header detection: first line matches isSolutionHeader() (e.g. \section*{פתרון})
  const solutionBlockIndices = new Set<number>()
  const exerciseOrigin = (exercise as unknown as Record<string, unknown>).origin as
    | string
    | undefined

  if (exerciseOrigin === 'context_extraction' && latexBlockIndices.length >= 2) {
    // Context extraction exercises: last LaTeX block is always the solution
    solutionBlockIndices.add(latexBlockIndices[latexBlockIndices.length - 1])
  } else {
    // Other origins: detect by solution header
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
  }

  // Build a map: exercise block index → solution LaTeX to attach after conversion
  const solutionForExercise = new Map<number, string>()
  for (const idx of latexBlockIndices) {
    if (solutionBlockIndices.has(idx)) continue
    // Find the next LaTeX block — if it's a solution, pair them
    const posInList = latexBlockIndices.indexOf(idx)
    const nextIdx = latexBlockIndices[posInList + 1]
    if (nextIdx !== undefined && solutionBlockIndices.has(nextIdx)) {
      solutionForExercise.set(idx, (blocks[nextIdx] as LatexBlock).latex)
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
      if (solutionForExercise.has(idx)) {
        attachSolutionToBlocks(result.blocks, solutionForExercise.get(idx)!)
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
        hasSolutionBlock: solutionForExercise.has(idx),
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
    const pairedSolution = solutionForExercise.get(idx)
    const latexForAI = pairedSolution
      ? `${latexBlock.latex}\n\n${pairedSolution}`
      : latexBlock.latex
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

  // Detect a trailing rich_text block that is actually solution content
  // (e.g., script parser produced "## פתרון תרגיל 1" header followed by answers).
  // Move its content into the previous question block's `solution` field and
  // remove the rich_text block, so the solution doesn't show as a "page" to students.
  rerouteTrailingSolutionRichText(nextBlocks, reqLogger)

  // AI fallback for missing solutions: any question block that didn't receive
  // a solution from the LaTeX (because the parser couldn't split per-sub-question
  // or there simply wasn't a matching solution) gets one generated by the AI.
  // This uses the same `generateSupport` service the admin "Generate with AI" button uses.
  await fillMissingSolutionsWithAI(nextBlocks, req.payload, reqLogger)

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
 * Split a solution LaTeX string by sub-question labels.
 *
 * Returns an array of solution parts in document order. Each part starts at
 * a label and ends just before the next label.
 *
 * Modes:
 * - 'hebrew': only top-level Hebrew letter labels (א., ב., ג., ...)
 * - 'all': both Hebrew letter and parenthetical numeric labels ((1), (2), ...).
 *   Empty parent labels (e.g. ג. immediately followed by (1)(2) with no
 *   content in between) are filtered out so they don't create empty parts.
 */
export function splitSolutionByLabels(text: string, mode: 'hebrew' | 'all'): string[] {
  const hebrewLetters = 'אבגדהוזחטי'
  const labelRegexes: RegExp[] = [new RegExp(`(^|\\n)\\s*([${hebrewLetters}])\\.\\s`, 'g')]
  if (mode === 'all') {
    labelRegexes.push(/(^|\n)\s*\((\d+)\)\s/g)
  }

  // Collect all label match positions
  const positions: number[] = []
  for (const re of labelRegexes) {
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      // m.index points to the leading char (^ or \n). Skip past the leading
      // newline to anchor the part at the actual label character.
      positions.push(m.index + (m[1] === '\n' ? 1 : 0))
    }
  }
  positions.sort((a, b) => a - b)
  // Deduplicate identical positions
  const uniquePositions = positions.filter((p, i) => i === 0 || p !== positions[i - 1])
  if (uniquePositions.length === 0) return []

  // Build candidate parts: each part runs from this position to the next
  // (or to the end of the text)
  const candidates: string[] = []
  for (let i = 0; i < uniquePositions.length; i++) {
    const start = uniquePositions[i]
    const end = i + 1 < uniquePositions.length ? uniquePositions[i + 1] : text.length
    candidates.push(text.slice(start, end).trim())
  }

  // Filter out empty parent labels: a label whose content is just the label
  // itself (e.g. "ג." with nothing after it before the next label). These
  // happen when ג. is just a header before nested (1)(2).
  const meaningful = candidates.filter((part) => {
    // Strip leading label and check if anything substantial remains
    const stripped = part.replace(/^\s*([אבגדהוזחטי]\.|\(\d+\))\s*/, '').trim()
    return stripped.length > 0
  })

  return meaningful
}

/**
 * Attach solution LaTeX content to question blocks' `solution` field.
 *
 * Strategy (in order of preference):
 * 1. Strip the solution header (if present)
 * 2. Find question blocks in document order
 * 3. If 0 question blocks → nothing to do
 * 4. If 1 question block → attach the whole solution to it
 * 5. If 2+ question blocks:
 *    a. Pass 1: split by Hebrew letter labels only
 *    b. Pass 2: split by Hebrew letters + numeric labels
 *    c. Pass 3: split by paragraph (double-newline) when no labels found
 *    For each pass, do best-effort distribution:
 *      - parts == questions → 1:1
 *      - parts > questions → first (N-1) get 1:1, last gets all remaining joined
 *      - parts < questions → first M questions get parts, rest stay empty
 *        (AI auto-fill will catch the empty ones in Phase 6)
 *    The first pass to produce any parts wins.
 * 6. If no pass produces any parts → fallback: dump on last question block
 */
export function attachSolutionToBlocks(blocks: ContentBlock[], solutionLatex: string): void {
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

  // Single question: whole solution goes to it
  if (questionIndices.length === 1) {
    setSolutionOnBlock(blocks[questionIndices[0]], contentWithoutHeader)
    return
  }

  // Multiple questions: try increasingly aggressive splitting strategies.
  // The first strategy that produces any parts wins; we then distribute
  // best-effort even if counts don't match exactly.
  const strategies: (() => string[])[] = [
    () => splitSolutionByLabels(contentWithoutHeader, 'hebrew'),
    () => splitSolutionByLabels(contentWithoutHeader, 'all'),
    () => splitByParagraphs(contentWithoutHeader),
  ]

  for (const strategy of strategies) {
    const parts = strategy()
    if (parts.length > 0) {
      distributeParts(blocks, questionIndices, parts)
      return
    }
  }

  // No strategy produced any parts — dump on last question block as ultimate fallback
  setSolutionOnBlock(blocks[questionIndices[questionIndices.length - 1]], contentWithoutHeader)
}

/**
 * Split text by paragraph boundaries (double newlines). Used as a fallback
 * when label-based splitting finds no labels.
 *
 * Returns paragraphs that have substantive content (>10 chars after trim).
 */
function splitByParagraphs(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 10)
  // Only useful as a strategy if we got more than one paragraph
  return paragraphs.length >= 2 ? paragraphs : []
}

/**
 * Distribute solution parts across question blocks with best-effort matching:
 * - parts.length === questions.length → 1:1 by position
 * - parts.length >  questions.length → first (N-1) get 1:1, last block gets
 *   all remaining parts joined (so no content is lost)
 * - parts.length <  questions.length → first M questions get a part each,
 *   remaining questions stay empty (AI auto-fill in Phase 6 will fill them)
 */
function distributeParts(blocks: ContentBlock[], questionIndices: number[], parts: string[]): void {
  const N = questionIndices.length
  const M = parts.length

  if (M === N) {
    // Perfect 1:1 match
    for (let i = 0; i < N; i++) {
      setSolutionOnBlock(blocks[questionIndices[i]], parts[i])
    }
    return
  }

  if (M > N) {
    // More parts than questions: first (N-1) get 1:1, last gets the rest
    for (let i = 0; i < N - 1; i++) {
      setSolutionOnBlock(blocks[questionIndices[i]], parts[i])
    }
    const remaining = parts.slice(N - 1).join('\n\n')
    setSolutionOnBlock(blocks[questionIndices[N - 1]], remaining)
    return
  }

  // M < N: fewer parts than questions. Assign each part to a question;
  // remaining questions stay empty for the AI auto-fill step to handle.
  for (let i = 0; i < M; i++) {
    setSolutionOnBlock(blocks[questionIndices[i]], parts[i])
  }
}

/** Set the `solution` field on a question block (md-math-v1 inline rich text). */
function setSolutionOnBlock(block: ContentBlock, value: string): void {
  const qBlock = block as ContentBlock & {
    solution?: { type: string; format: string; value: string; mediaIds: string[] }
  }
  qBlock.solution = {
    type: 'rich_text',
    format: 'md-math-v1',
    value,
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

/**
 * Fill missing `hint` and `solution` fields on question blocks using AI generation.
 *
 * Walks the blocks array and, for each question block that's missing either
 * a hint or a solution, calls the same `generateSupport` service the admin
 * "Generate with AI" button uses.
 *
 * Only requests the fields that are missing — if the block already has a
 * solution from the LaTeX (Phase 4), we only ask the AI to generate a hint.
 *
 * Mutates `blocks` in place. Failures are logged and the block is left as-is
 * rather than aborting the conversion.
 */
export async function fillMissingSolutionsWithAI(
  blocks: ContentBlock[],
  payload: PayloadRequest['payload'],
  reqLogger: typeof logger,
): Promise<void> {
  // For each question block, determine which fields are missing
  type Target = {
    idx: number
    targetFields: ('hints' | 'solution')[]
  }
  const targets: Target[] = []
  for (let i = 0; i < blocks.length; i++) {
    if (!isQuestionBlock(blocks[i])) continue
    const b = blocks[i] as ContentBlock & { hint?: InlineRichText; solution?: InlineRichText }
    const missing: ('hints' | 'solution')[] = []
    if (!b.hint?.value) missing.push('hints')
    if (!b.solution?.value) missing.push('solution')
    if (missing.length > 0) {
      targets.push({ idx: i, targetFields: missing })
    }
  }

  if (targets.length === 0) {
    return
  }

  reqLogger.info(
    {
      blocksToFill: targets.length,
      totalBlocks: blocks.length,
      breakdown: targets.map((t) => ({ idx: t.idx, fields: t.targetFields })),
    },
    'Filling missing hints/solutions with AI',
  )

  // Generate sequentially to avoid overwhelming the LLM API / hitting rate limits.
  for (const { idx, targetFields } of targets) {
    const block = blocks[idx]
    try {
      const result = await generateSupport(
        {
          block,
          targetFields,
        },
        payload,
      )

      if (result.success && result.data) {
        // applyGeneratedSupport handles the immutable update — replace in place
        blocks[idx] = applyGeneratedSupport(block, result.data, false)
      } else {
        reqLogger.warn(
          { blockId: block.id, fields: targetFields, error: result.error },
          'AI hint/solution generation failed for block',
        )
      }
    } catch (err) {
      reqLogger.warn(
        {
          blockId: block.id,
          fields: targetFields,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        'AI hint/solution generation threw',
      )
    }
  }
}

/**
 * Detect a trailing rich_text block that is actually solution content (e.g.,
 * the script parser converted `\section*{פתרון תרגיל N}` into a markdown
 * `## פתרון ...` header followed by answers). Such a block ends up rendered
 * as a separate "page" to students, mixing the answers into the question flow.
 *
 * If detected: extract the body (after the header line), attach it to the
 * preceding question block's `solution` field (when empty), and remove the
 * rich_text block from the array.
 *
 * Mutates `blocks` in place.
 */
function rerouteTrailingSolutionRichText(blocks: ContentBlock[], reqLogger: typeof logger): void {
  if (blocks.length === 0) return

  // Find the last non-empty rich_text block
  let trailingIdx = -1
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if (b.type === 'rich_text') {
      trailingIdx = i
      break
    }
    // Stop if we hit a question block (means there's no trailing rich_text after questions)
    if (isQuestionBlock(b)) {
      return
    }
  }

  if (trailingIdx < 0) return

  const trailing = blocks[trailingIdx] as ContentBlock & { value?: string }
  const value = trailing.value || ''
  if (!looksLikeSolutionContent(value)) return

  // Strip the solution header line and use the rest as the solution body
  const body = stripSolutionHeaderLine(value).trim()
  if (!body) {
    // Header only with no body — just remove the block, nothing to attach
    blocks.splice(trailingIdx, 1)
    reqLogger.info(
      { blockId: trailing.id },
      'Removed trailing rich_text solution header (empty body)',
    )
    return
  }

  // Find the previous question block (could be at any position before trailingIdx)
  let qIdx = -1
  for (let i = trailingIdx - 1; i >= 0; i--) {
    if (isQuestionBlock(blocks[i])) {
      qIdx = i
      break
    }
  }

  if (qIdx < 0) {
    // No question block to attach to — just remove the trailing solution block
    // (it's not useful as a standalone block to students)
    blocks.splice(trailingIdx, 1)
    reqLogger.info(
      { blockId: trailing.id },
      'Removed trailing rich_text solution (no preceding question block)',
    )
    return
  }

  const qBlock = blocks[qIdx] as ContentBlock & { solution?: InlineRichText }
  if (qBlock.solution?.value) {
    // Question already has a solution — append rather than overwrite
    qBlock.solution = {
      type: 'rich_text',
      format: 'md-math-v1',
      value: `${qBlock.solution.value}\n\n${body}`,
      mediaIds: [],
    }
    reqLogger.info(
      { questionBlockId: qBlock.id, removedBlockId: trailing.id },
      'Appended trailing solution rich_text to existing question solution',
    )
  } else {
    qBlock.solution = {
      type: 'rich_text',
      format: 'md-math-v1',
      value: body,
      mediaIds: [],
    }
    reqLogger.info(
      { questionBlockId: qBlock.id, removedBlockId: trailing.id },
      'Moved trailing solution rich_text into question solution',
    )
  }

  // Remove the rich_text block
  blocks.splice(trailingIdx, 1)
}

/**
 * Detect whether a rich_text block's value looks like solution content.
 * After parsing, `\section*{פתרון}` becomes `## פתרון`, `\textbf{פתרון}`
 * becomes `**פתרון**`, etc. We match the post-parse forms.
 */
export function looksLikeSolutionContent(value: string): boolean {
  if (!value) return false
  const firstLine =
    value
      .trim()
      .split('\n')
      .find((l) => l.trim().length > 0) || ''

  // Markdown header from \section*{פתרון ...} or \subsection*{פתרון ...}
  if (/^#{1,3}\s*פתרון/.test(firstLine)) return true
  if (/^#{1,3}\s*פתרונות/.test(firstLine)) return true
  if (/^#{1,3}\s*תשובה\s+סופית/.test(firstLine)) return true

  // Bold from \textbf{פתרון תרגיל N:} or \textbf{פתרון שאלה N:}
  if (/^\*\*\s*פתרון\s+(?:תרגיל|שאלה)/.test(firstLine)) return true

  // Plain prefix (parser may strip formatting in some cases)
  if (/^פתרון\s+(?:תרגיל|שאלה)\s+\d+/.test(firstLine)) return true
  if (/^פתרונות(\s|$)/.test(firstLine)) return true
  if (/^תשובה\s+סופית/.test(firstLine)) return true

  return false
}

/**
 * Remove the first non-empty line if it's a solution header marker,
 * leaving the body of the solution. Used to clean rich_text content
 * before attaching it to a question's `solution` field.
 */
function stripSolutionHeaderLine(value: string): string {
  const lines = value.split('\n')
  const firstNonEmptyIdx = lines.findIndex((l) => l.trim().length > 0)
  if (firstNonEmptyIdx < 0) return value
  const firstLine = lines[firstNonEmptyIdx]
  const isHeader =
    /^#{1,3}\s*פתרון/.test(firstLine.trim()) ||
    /^#{1,3}\s*פתרונות/.test(firstLine.trim()) ||
    /^\*\*\s*פתרון/.test(firstLine.trim()) ||
    /^פתרון\s+(?:תרגיל|שאלה)/.test(firstLine.trim()) ||
    /^פתרונות(\s|$)/.test(firstLine.trim()) ||
    /^תשובה\s+סופית/.test(firstLine.trim())
  if (!isHeader) return value
  return lines.slice(firstNonEmptyIdx + 1).join('\n')
}
