/**
 * POST /api/exercises/import-latex-ai
 * AI-powered LaTeX → exercise blocks import.
 *
 * Sends the raw LaTeX to Gemini and asks it to produce exercise content blocks
 * in the same JSON format the script parser outputs. Falls back to AI when the
 * deterministic parser can't handle edge-case LaTeX.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { logger } from '@/infra/utils/logger'
import { ContentSchema } from '@/server/payload/collections/Exercises/schemas'
import { generateId } from '@/server/payload/collections/Exercises/types'

const InputSchema = z.object({
  latex: z.string().min(1).max(500_000),
  lessonId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const parsed = InputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const { latex, lessonId } = parsed.data
    const reqLogger = logger.child({ requestId: crypto.randomUUID() })

    // Verify lesson exists
    try {
      await payload.findByID({ collection: 'lessons', id: lessonId })
    } catch {
      return NextResponse.json({ success: false, error: 'Lesson not found' }, { status: 404 })
    }

    // Split the LaTeX into individual exercises before sending to AI.
    // Sending the whole file at once causes truncated JSON responses.
    const chunks = splitLatexIntoExercises(latex)
    reqLogger.info({ chunkCount: chunks.length }, 'Split LaTeX into exercise chunks for AI')

    // Use Genkit unified adapter for AI parsing
    const { createGenkitUnifiedAdapter } =
      await import('@/infra/llm/genkit/adapters/unified-adapter')
    const adapter = await createGenkitUnifiedAdapter(payload)
    const { getModelRegistryEntry, getProviderModelName } = await import('@/infra/llm/models')
    const { LLMProviderType } = await import('@/infra/llm/providers/types')

    const modelEntry = getModelRegistryEntry('PDF_TO_EXERCISE')
    const modelConfig = {
      name: getProviderModelName(LLMProviderType.GEMINI, 'PDF_TO_EXERCISE'),
      ...modelEntry,
      modelKey: 'PDF_TO_EXERCISE' as const,
    }

    // Process each exercise chunk: AI for text, script parser for diagrams (if available)
    let parseLatex:
      | ((latex: string) => {
          exercises: Array<{ title: string; blocks: Array<{ type: string }> }>
          warnings: unknown[]
          errors: unknown[]
        })
      | null = null
    try {
      const mod = await import('@/lib/latex-parser')
      parseLatex = mod.parseLatexToExercises
    } catch {
      reqLogger.info('Script parser not available, AI-only mode')
    }

    const rawExercises: Array<{ title: string; blocks: unknown[] }> = []
    const aiErrors: string[] = []

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci]

      // Step 1: Run script parser to extract diagram blocks (axis, geometry)
      const diagramBlocks: unknown[] = []
      let scriptResult: {
        exercises: Array<{ title: string; blocks: Array<{ type: string }> }>
        warnings: unknown[]
        errors: unknown[]
      } | null = null
      if (parseLatex) {
        scriptResult = parseLatex(chunk.latex)
        for (const ex of scriptResult.exercises) {
          for (const block of ex.blocks) {
            if (
              block.type === 'question_axis' ||
              block.type === 'question_geometry' ||
              block.type === 'question_multi_axis'
            ) {
              diagramBlocks.push(block)
            }
          }
        }
      }

      // Step 2: AI for text/questions
      try {
        const { system, userMessage } = await buildAiParserPrompt(chunk.latex)

        const result = await adapter.generateChatCompletion(
          {
            system,
            messages: [{ role: 'user', content: userMessage }],
            model: modelConfig,
            acknowledgment: `Parsing exercise ${ci + 1}/${chunks.length} into blocks.`,
          },
          payload,
        )

        const parsed = extractJsonFromResponse(result.text)
        if (parsed) {
          const exercises = Array.isArray(parsed.exercises) ? parsed.exercises : [parsed]
          for (const ex of exercises) {
            // Step 3: Merge — replace [diagram] placeholders with actual diagram blocks
            const mergedBlocks = mergeDiagramBlocks(ex.blocks || [], diagramBlocks)
            rawExercises.push({
              title: ex.title || chunk.title || `Exercise ${ci + 1}`,
              blocks: mergedBlocks,
            })
          }
        } else {
          // AI failed — fall back to script-only result if it has content
          if (
            scriptResult &&
            scriptResult.exercises.length > 0 &&
            scriptResult.exercises[0].blocks.length > 0
          ) {
            for (const ex of scriptResult.exercises) {
              rawExercises.push({
                title: ex.title || chunk.title || `Exercise ${ci + 1}`,
                blocks: ex.blocks,
              })
            }
            reqLogger.info({ chunkIndex: ci }, 'AI failed, fell back to script parser')
          } else {
            reqLogger.warn(
              { chunkIndex: ci, responsePreview: result.text.slice(0, 300) },
              'AI returned unparseable response for chunk',
            )
            aiErrors.push(`Exercise ${ci + 1} (${chunk.title || 'untitled'}): invalid AI response`)
          }
        }
      } catch (err) {
        // AI call failed — fall back to script parser
        if (
          scriptResult &&
          scriptResult.exercises.length > 0 &&
          scriptResult.exercises[0].blocks.length > 0
        ) {
          for (const ex of scriptResult.exercises) {
            rawExercises.push({
              title: ex.title || chunk.title || `Exercise ${ci + 1}`,
              blocks: ex.blocks,
            })
          }
          reqLogger.info({ chunkIndex: ci }, 'AI call failed, fell back to script parser')
        } else {
          reqLogger.error({ chunkIndex: ci, err }, 'AI call failed for chunk')
          aiErrors.push(
            `Exercise ${ci + 1}: ${err instanceof Error ? err.message : 'unknown error'}`,
          )
        }
      }
    }

    if (rawExercises.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `AI failed to parse all exercises. ${aiErrors[0] ?? ''}`,
        },
        { status: 422 },
      )
    }

    // Find existing exercise count for ordering
    const existing = await payload.find({
      collection: 'exercises',
      where: { lesson: { equals: lessonId } },
      limit: 0,
    })
    const startOrder = existing.totalDocs

    const createdIds: string[] = []
    const errors: string[] = []

    for (let i = 0; i < rawExercises.length; i++) {
      const group = rawExercises[i]
      const repairedBlocks = repairBlocks(group.blocks ?? [])

      // Validate against ContentSchema
      const validation = ContentSchema.safeParse({ blocks: repairedBlocks })
      if (!validation.success) {
        const issues = validation.error.issues
          .slice(0, 3)
          .map((iss) => `[${iss.path.join('.')}] ${iss.message}`)
          .join('; ')
        reqLogger.warn(
          { exerciseIndex: i, issues, blockCount: repairedBlocks.length },
          'AI block validation failed after repair',
        )
        errors.push(`Exercise ${i + 1}: ${issues}`)
        continue
      }

      const exercise = await payload.create({
        collection: 'exercises',
        data: {
          lesson: lessonId,
          title: group.title || undefined,
          content: { blocks: validation.data.blocks },
          origin: 'import',
          order: startOrder + i,
        },
        draft: true,
      })
      createdIds.push(exercise.id)
    }

    reqLogger.info(
      { lessonId, created: createdIds.length, failed: errors.length },
      'AI LaTeX import complete',
    )

    if (createdIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `All exercises failed validation. ${errors[0] ?? ''}`,
        },
        { status: 422 },
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        exerciseIds: createdIds,
        exerciseCount: createdIds.length,
        warnings: errors.length > 0 ? errors : undefined,
      },
    })
  } catch (error) {
    logger.error({ err: error }, '[API Route] Error in /api/exercises/import-latex-ai')
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    )
  }
}

/**
 * Repair common AI output issues to match our strict Zod schemas.
 * Adds missing ids, fixes field names, ensures required defaults.
 */
function repairBlocks(blocks: unknown[]): unknown[] {
  return blocks.map((block) => {
    if (typeof block !== 'object' || block === null) return block
    const b = block as Record<string, unknown>

    // Ensure every block has an id
    if (!b.id || typeof b.id !== 'string') {
      b.id = generateId()
    }

    // Repair rich_text blocks
    if (b.type === 'rich_text') {
      if (!b.format) b.format = 'md-math-v1'
      if (!Array.isArray(b.mediaIds)) b.mediaIds = []
      // Remove extra fields the AI might add
      return pick(b, ['id', 'type', 'format', 'value', 'mediaIds'])
    }

    // Repair question_free_response
    if (b.type === 'question_free_response') {
      repairInlineRichText(b, 'prompt')
      repairInlineRichText(b, 'hint')
      repairInlineRichText(b, 'solution')
      repairInlineRichText(b, 'fullSolution')

      // Ensure answer has acceptedAnswers with at least 1 item
      if (b.answer && typeof b.answer === 'object') {
        const ans = b.answer as Record<string, unknown>
        if (!Array.isArray(ans.acceptedAnswers) || ans.acceptedAnswers.length === 0) {
          ans.acceptedAnswers = ['-']
        }
        b.answer = pick(ans, ['acceptedAnswers'])
      } else {
        b.answer = { acceptedAnswers: ['-'] }
      }

      return pick(b, ['id', 'type', 'prompt', 'answer', 'hint', 'solution', 'fullSolution'])
    }

    // Repair question_select (MCQ)
    if (b.type === 'question_select') {
      if (!b.variant) b.variant = 'mcq'
      if (!b.selectionMode) b.selectionMode = 'single'

      repairInlineRichText(b, 'prompt')
      repairInlineRichText(b, 'hint')
      repairInlineRichText(b, 'solution')
      repairInlineRichText(b, 'fullSolution')

      if (b.answer && typeof b.answer === 'object') {
        const ans = b.answer as Record<string, unknown>
        if (ans.multiSelect === undefined) ans.multiSelect = false

        // Repair options inside answer
        if (Array.isArray(ans.options)) {
          ans.options = (ans.options as unknown[]).map((opt) => {
            if (typeof opt !== 'object' || opt === null) return opt
            const o = opt as Record<string, unknown>
            if (!o.id) o.id = generateId()
            repairInlineRichText(o, 'content')
            return pick(o, ['id', 'content'])
          })
        }

        if (!Array.isArray(ans.correctOptionIds)) {
          ans.correctOptionIds = []
        }

        // MCQ needs at least 2 options — downgrade to free_response if not enough
        if (!Array.isArray(ans.options) || ans.options.length < 2) {
          b.type = 'question_free_response'
          b.answer = { acceptedAnswers: ['-'] }
          return pick(b, ['id', 'type', 'prompt', 'answer', 'hint', 'solution', 'fullSolution'])
        }

        b.answer = pick(ans, ['multiSelect', 'options', 'correctOptionIds'])
      }

      return pick(b, [
        'id',
        'type',
        'variant',
        'selectionMode',
        'prompt',
        'answer',
        'hint',
        'solution',
        'fullSolution',
      ])
    }

    // Repair question_table
    if (b.type === 'question_table') {
      repairInlineRichText(b, 'prompt')

      if (b.table && typeof b.table === 'object') {
        const t = b.table as Record<string, unknown>
        if (t.solutionFill === undefined) t.solutionFill = false
        if (t.showBorders === undefined) t.showBorders = true
        if (t.showHeader === undefined) t.showHeader = true
        b.table = pick(t, [
          'solutionFill',
          'headers',
          'rowsData',
          'answers',
          'showBorders',
          'showHeader',
          'columnAlignment',
        ])
      }

      return pick(b, [
        'id',
        'type',
        'prompt',
        'table',
        'answer',
        'hint',
        'solution',
        'fullSolution',
      ])
    }

    // Repair latex blocks
    if (b.type === 'latex') {
      if (!b.renderMode) b.renderMode = 'block'
      return pick(b, ['id', 'type', 'latex', 'renderMode'])
    }

    return b
  })
}

/** Repair an inline rich_text field (prompt, hint, solution, etc.) */
function repairInlineRichText(obj: Record<string, unknown>, field: string): void {
  const val = obj[field]
  if (!val) return
  if (typeof val === 'string') {
    // AI sometimes puts a plain string instead of a rich_text object
    obj[field] = { type: 'rich_text', format: 'md-math-v1', value: val, mediaIds: [] }
    return
  }
  if (typeof val === 'object' && val !== null) {
    const rt = val as Record<string, unknown>
    if (!rt.type) rt.type = 'rich_text'
    if (!rt.format) rt.format = 'md-math-v1'
    if (!Array.isArray(rt.mediaIds)) rt.mediaIds = []
    obj[field] = pick(rt, ['type', 'format', 'value', 'mediaIds'])
  }
}

/** Pick specified keys from an object, filtering out undefined values */
function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    if (obj[key] !== undefined) {
      result[key] = obj[key]
    }
  }
  return result
}

/**
 * Replace AI [diagram] placeholder blocks with actual parsed diagram blocks.
 * Diagram blocks are inserted in order — first [diagram] gets first diagram block, etc.
 */
function mergeDiagramBlocks(aiBlocks: unknown[], diagramBlocks: unknown[]): unknown[] {
  if (diagramBlocks.length === 0) return aiBlocks

  const result: unknown[] = []
  let diagramIdx = 0

  for (const block of aiBlocks) {
    if (isDiagramPlaceholder(block) && diagramIdx < diagramBlocks.length) {
      result.push(diagramBlocks[diagramIdx])
      diagramIdx++
    } else {
      result.push(block)
    }
  }

  // Append any remaining diagram blocks that didn't match a placeholder
  while (diagramIdx < diagramBlocks.length) {
    result.push(diagramBlocks[diagramIdx])
    diagramIdx++
  }

  return result
}

/** Check if a block is an AI-generated [diagram] placeholder */
function isDiagramPlaceholder(block: unknown): boolean {
  if (typeof block !== 'object' || block === null) return false
  const b = block as Record<string, unknown>
  if (b.type !== 'rich_text') return false
  const val = String(b.value || '').toLowerCase()
  return val.includes('[diagram]') || val.includes('[graph]') || val.includes('[tikz')
}

/**
 * Split a full LaTeX document into individual exercise chunks.
 * Uses the same \textbf{תרגיל N} boundary the script parser uses.
 */
function splitLatexIntoExercises(latex: string): Array<{ title: string; latex: string }> {
  // Strip preamble (everything before \begin{document})
  const docStart = latex.indexOf('\\begin{document}')
  const body = docStart >= 0 ? latex.slice(docStart) : latex

  // Split on exercise titles: \textbf{תרגיל N ...}
  const exercisePattern = /\\textbf\{תרגיל\s+(\d+)[^}]*\}/g
  const matches = [...body.matchAll(exercisePattern)]

  if (matches.length === 0) {
    // No exercise boundaries found — send the whole thing as one chunk
    return [{ title: '', latex: body }]
  }

  const chunks: Array<{ title: string; latex: string }> = []

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const start = match.index!
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length
    const chunkLatex = body.slice(start, end).trim()

    // Skip solution sections
    if (/^\\section\*?\{פתרון/.test(chunkLatex)) continue

    chunks.push({
      title: match[0].replace(/\\textbf\{|\}/g, '').trim(),
      latex: chunkLatex,
    })
  }

  // Filter out solution exercises (title contains "פתרון")
  return chunks.filter((c) => !c.title.includes('פתרון'))
}

/**
 * Extract JSON from AI response text. Handles:
 * - Markdown code fences
 * - Leading text before JSON
 * - Truncated JSON (attempts repair)
 */
function extractJsonFromResponse(text: string): Record<string, unknown> | null {
  let responseText = text.trim()

  // Extract from code fences
  const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)```/.exec(responseText)
  if (fenceMatch) {
    responseText = fenceMatch[1].trim()
  }

  // Find first { or [
  const jsonStart = responseText.search(/[{[]/)
  if (jsonStart > 0) {
    responseText = responseText.slice(jsonStart)
  }
  if (jsonStart < 0) return null

  try {
    return JSON.parse(responseText) as Record<string, unknown>
  } catch {
    // Try repair
    const repaired = repairTruncatedJson(responseText)
    if (repaired) {
      try {
        return JSON.parse(repaired) as Record<string, unknown>
      } catch {
        return null
      }
    }
    return null
  }
}

/**
 * Try to repair truncated JSON by closing open brackets/braces.
 * Returns repaired string or null if unrepairable.
 */
function repairTruncatedJson(text: string): string | null {
  // Count open/close brackets
  let braces = 0
  let brackets = 0
  let inString = false
  let escaped = false

  for (const ch of text) {
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') braces++
    else if (ch === '}') braces--
    else if (ch === '[') brackets++
    else if (ch === ']') brackets--
  }

  if (braces === 0 && brackets === 0) return null // Not a truncation issue

  // Close the string if we're inside one
  let repaired = text
  if (inString) repaired += '"'

  // Close open brackets/braces
  while (brackets > 0) {
    repaired += ']'
    brackets--
  }
  while (braces > 0) {
    repaired += '}'
    braces--
  }

  return repaired
}

const DEFAULT_SYSTEM_PROMPT = `You are an expert at converting LaTeX math exercises into structured JSON content blocks.

You receive LaTeX source code and output a JSON object with this structure:
{
  "exercises": [
    {
      "title": "תרגיל 1 - Title",
      "blocks": [/* content blocks */]
    }
  ]
}

## Block Types

Each block must have an "id" (random string like "b-abc1234") and a "type".

### rich_text
{ "id": "...", "type": "rich_text", "format": "md-math-v1", "value": "markdown with $inline$ or $$block$$ math", "mediaIds": [] }

### question_free_response
{ "id": "...", "type": "question_free_response", "prompt": { "type": "rich_text", "format": "md-math-v1", "value": "question text with $math$", "mediaIds": [] }, "answer": { "acceptedAnswers": ["42"] } }

### question_select (MCQ)
{ "id": "...", "type": "question_select", "variant": "mcq", "selectionMode": "single", "prompt": { "type": "rich_text", "format": "md-math-v1", "value": "question", "mediaIds": [] }, "answer": { "multiSelect": false, "options": [{ "id": "opt-1", "content": { "type": "rich_text", "format": "md-math-v1", "value": "option text", "mediaIds": [] } }], "correctOptionIds": ["opt-1"] } }

### question_table
{ "id": "...", "type": "question_table", "prompt": { "type": "rich_text", "format": "md-math-v1", "value": "question", "mediaIds": [] }, "table": { "solutionFill": false, "headers": ["col1", "col2"], "rowsData": [["val1", "val2"]], "showBorders": true, "showHeader": true } }

### latex (for display math that isn't part of a question)
{ "id": "...", "type": "latex", "latex": "\\\\frac{x}{y}", "renderMode": "block" }

## CRITICAL Rules
- Use "md-math-v1" format for ALL rich text objects — prompt, hint, solution, option content
- EVERY rich text object MUST have exactly: type, format, value, mediaIds (array) — NO extra fields
- Wrap inline math with $...$ and block math with $$...$$
- Convert Hebrew text as-is
- Each sub-question (א, ב, ג, etc.) should be a separate question block
- If a question has multiple choice options, use question_select with variant "mcq"
- If a question requires a free-form answer, use question_free_response
- Tables (\\begin{tabular}) become question_table blocks
- For TikZ diagrams: create a rich_text block with "[diagram]" — do NOT try to reproduce the diagram content
- Skip preamble, \\documentclass, \\usepackage, etc.
- Skip solution sections (\\section*{פתרון ...})
- Be CONCISE — minimal block content, no verbose explanations in values
- Return ONLY valid JSON — no markdown fences, no comments, no explanatory text`

async function getSystemPrompt(): Promise<string> {
  try {
    const { getConfigValueByKey } = await import('@/infra/config/runtime/config-values')
    const { ConfigDomain } = await import('@/infra/config/config-constants')
    const prompt = await getConfigValueByKey<string>(
      ConfigDomain.LatexConversion,
      'ai_system_prompt',
      { defaultValue: DEFAULT_SYSTEM_PROMPT, throwIfNotFound: false },
    )
    return prompt || DEFAULT_SYSTEM_PROMPT
  } catch {
    return DEFAULT_SYSTEM_PROMPT
  }
}

async function buildAiParserPrompt(
  latex: string,
): Promise<{ system: string; userMessage: string }> {
  const system = await getSystemPrompt()
  const userMessage = `Convert this LaTeX into exercise blocks JSON:\n\n${latex}`
  return { system, userMessage }
}
