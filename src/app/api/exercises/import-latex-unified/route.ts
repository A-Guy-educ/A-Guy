/**
 * POST /api/exercises/import-latex-unified
 * Unified LaTeX → exercises import with automatic script→AI fallback.
 *
 * Flow:
 * 1. Try deterministic script parser first
 * 2. If script returns 0 exercises OR all fail validation → try AI (if fallback_enabled)
 * 3. Partial success (1+ valid) = return script result, no fallback
 * 4. Track analytics on fallback
 *
 * @fileType api-route
 * @domain exercises
 * @pattern latex-import,fallback,unified-converter
 * @ai-summary Unified LaTeX import with script-to-AI fallback
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { parseLatexToExercises } from '@/lib/latex-parser'
import { ContentSchema } from '@/server/payload/collections/Exercises/schemas'
import { generateId } from '@/server/payload/collections/Exercises/types'
import { logger } from '@/infra/utils/logger'

const InputSchema = z.object({
  latex: z.string().min(1).max(500_000),
  lessonId: z.string().min(1),
})

type ImportMethod = 'script' | 'ai_fallback'

interface ScriptParseResult {
  exercises: Array<{ title: string; blocks: unknown[]; rawLatex: string }>
  errors: Array<{ line: number; message: string; rawLatex: string }>
  warnings: Array<{ line: number; message: string; rawLatex: string }>
}

export async function POST(request: NextRequest) {
  const reqLogger = logger.child({ requestId: crypto.randomUUID() })

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
    reqLogger.info({ lessonId, latexLength: latex.length }, 'Unified LaTeX import started')

    // Verify lesson exists
    try {
      await payload.findByID({ collection: 'lessons', id: lessonId })
    } catch {
      return NextResponse.json({ success: false, error: 'Lesson not found' }, { status: 404 })
    }

    // Step 1: Try script parser
    const scriptResult = tryScriptParser(latex)
    reqLogger.info(
      { scriptExerciseCount: scriptResult.exercises.length, scriptErrors: scriptResult.errors.length },
      'Script parser result',
    )

    // Step 2: Validate script exercises against schema
    const validScriptExercises = scriptResult.exercises.filter((ex) => {
      const validation = ContentSchema.safeParse({ blocks: ex.blocks })
      return validation.success
    })

    // Step 3: Decide if fallback is needed
    const needsFallback =
      scriptResult.exercises.length === 0 ||
      (validScriptExercises.length === 0 && scriptResult.exercises.length > 0)

    let method: ImportMethod = 'script'
    let finalExercises: Array<{ title: string; blocks: unknown[]; rawLatex: string }> = []

    if (needsFallback) {
      // Check fallback_enabled config
      const fallbackEnabled = await isFallbackEnabled()
      reqLogger.info({ fallbackEnabled, needsFallback }, 'Fallback decision')

      if (fallbackEnabled) {
        reqLogger.info('Attempting AI fallback for LaTeX import')
        const aiResult = await tryAiParser(latex, reqLogger as unknown as ReturnType<typeof logger.child>)

        if (aiResult.exercises.length > 0) {
          finalExercises = aiResult.exercises
          method = 'ai_fallback'
          reqLogger.info({ aiExerciseCount: aiResult.exercises.length }, 'AI fallback succeeded')
        } else {
          reqLogger.warn({ aiErrors: aiResult.errors }, 'AI fallback also failed')
          // AI failed too - return script errors if we have any
          if (scriptResult.errors.length > 0) {
            return NextResponse.json(
              {
                success: false,
                error: 'Script parser failed and AI fallback also failed',
                method,
                scriptErrors: scriptResult.errors,
                aiErrors: aiResult.errors,
              },
              { status: 422 },
            )
          }
        }
      } else {
        reqLogger.info('Fallback disabled, returning script result')
        // Fallback disabled - return what we have from script
        if (scriptResult.errors.length > 0) {
          return NextResponse.json(
            {
              success: false,
              errors: scriptResult.errors,
              method,
            },
            { status: 422 },
          )
        }
      }
    }

    // If we haven't gotten exercises from AI yet, use script results
    if (finalExercises.length === 0) {
      finalExercises = validScriptExercises.length > 0 ? validScriptExercises : scriptResult.exercises
    }

    // If still no exercises, return error
    if (finalExercises.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No parseable content found',
          method,
        },
        { status: 422 },
      )
    }

    // Step 4: Create exercises in database
    const existing = await payload.find({
      collection: 'exercises',
      where: { lesson: { equals: lessonId } },
      limit: 0,
    })
    const startOrder = existing.totalDocs

    const createdIds: string[] = []
    const creationErrors: string[] = []

    for (let i = 0; i < finalExercises.length; i++) {
      const ex = finalExercises[i]
      const repairedBlocks = repairBlocks(ex.blocks)

      const validation = ContentSchema.safeParse({ blocks: repairedBlocks })
      if (!validation.success) {
        const issues = validation.error.issues
          .slice(0, 3)
          .map((iss) => `[${iss.path.join('.')}] ${iss.message}`)
          .join('; ')
        creationErrors.push(`Exercise ${i + 1}: ${issues}`)
        continue
      }

      const exercise = await payload.create({
        collection: 'exercises',
        data: {
          lesson: lessonId,
          title: ex.title || undefined,
          content: { blocks: validation.data.blocks },
          origin: 'import',
          sourceLatex: ex.rawLatex || undefined,
          order: startOrder + i,
        } as any,
        draft: true,
      })
      createdIds.push(exercise.id)
    }

    reqLogger.info(
      { lessonId, created: createdIds.length, failed: creationErrors.length, method },
      'Unified LaTeX import complete',
    )

    if (createdIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'All exercises failed validation',
          method,
          errors: creationErrors,
        },
        { status: 422 },
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        exerciseIds: createdIds,
        exerciseCount: createdIds.length,
        method,
        warnings: creationErrors.length > 0 ? creationErrors : undefined,
      },
    })
  } catch (error) {
    logger.error({ err: error }, '[API Route] Error in /api/exercises/import-latex-unified')
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
 * Check if AI fallback is enabled via config
 */
async function isFallbackEnabled(): Promise<boolean> {
  try {
    const { getConfigValueByKey } = await import('@/infra/config/runtime/config-values')
    const { ConfigDomain } = await import('@/infra/config/config-constants')
    const enabled = await getConfigValueByKey<boolean>(
      ConfigDomain.LatexConversion,
      'fallback_enabled',
      { defaultValue: true, throwIfNotFound: false },
    )
    return enabled ?? true
  } catch {
    return true // Default to enabled
  }
}

/**
 * Try script parser and return structured result
 */
function tryScriptParser(latex: string): ScriptParseResult {
  const result = parseLatexToExercises(latex)

  return {
    exercises: result.exercises.map((ex) => ({
      title: ex.title,
      blocks: ex.blocks,
      rawLatex: latex, // Store full LaTeX as source
    })),
    errors: result.errors,
    warnings: result.warnings,
  }
}

/**
 * Try AI parser for LaTeX → exercises
 */
async function tryAiParser(
  latex: string,
  reqLogger: ReturnType<typeof logger.child>,
): Promise<{ exercises: Array<{ title: string; blocks: unknown[]; rawLatex: string }>; errors: string[] }> {
  try {
    // Use Genkit unified adapter for AI parsing
    const { createGenkitUnifiedAdapter } = await import('@/infra/llm/genkit/adapters/unified-adapter')
    const payload = await getPayload({ config })
    const adapter = await createGenkitUnifiedAdapter(payload)
    const { getModelRegistryEntry, getProviderModelName } = await import('@/infra/llm/models')
    const { LLMProviderType } = await import('@/infra/llm/providers/types')

    const modelEntry = getModelRegistryEntry('PDF_TO_EXERCISE')
    const modelConfig = {
      name: getProviderModelName(LLMProviderType.GEMINI, 'PDF_TO_EXERCISE'),
      ...modelEntry,
      modelKey: 'PDF_TO_EXERCISE' as const,
    }

    // Split LaTeX into exercise chunks
    const chunks = splitLatexIntoExercises(latex)
    reqLogger.info({ chunkCount: chunks.length }, 'Split LaTeX into chunks for AI')

    // Get script parser for diagram blocks
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
      reqLogger.info('Script parser not available for AI fallback')
    }

    const rawExercises: Array<{ title: string; blocks: unknown[]; rawLatex: string }> = []
    const aiErrors: string[] = []

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci]

      // Step 1: Run script parser to extract diagram blocks
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
            const mergedBlocks = mergeDiagramBlocks(ex.blocks || [], diagramBlocks)
            rawExercises.push({
              title: ex.title || chunk.title || `Exercise ${ci + 1}`,
              blocks: mergedBlocks,
              rawLatex: chunk.latex,
            })
          }
        } else {
          // AI failed — fall back to script if it has content
          if (
            scriptResult &&
            scriptResult.exercises.length > 0 &&
            scriptResult.exercises[0].blocks.length > 0
          ) {
            for (const ex of scriptResult.exercises) {
              rawExercises.push({
                title: ex.title || chunk.title || `Exercise ${ci + 1}`,
                blocks: ex.blocks,
                rawLatex: chunk.latex,
              })
            }
            reqLogger.info({ chunkIndex: ci }, 'AI failed, used script parser fallback')
          } else {
            aiErrors.push(`Exercise ${ci + 1} (${chunk.title || 'untitled'}): invalid AI response`)
          }
        }
      } catch (err) {
        // AI call failed — fall back to script
        if (
          scriptResult &&
          scriptResult.exercises.length > 0 &&
          scriptResult.exercises[0].blocks.length > 0
        ) {
          for (const ex of scriptResult.exercises) {
            rawExercises.push({
              title: ex.title || chunk.title || `Exercise ${ci + 1}`,
              blocks: ex.blocks,
              rawLatex: chunk.latex,
            })
          }
          reqLogger.info({ chunkIndex: ci }, 'AI call failed, used script parser fallback')
        } else {
          reqLogger.error({ chunkIndex: ci, err }, 'AI call failed for chunk')
          aiErrors.push(
            `Exercise ${ci + 1}: ${err instanceof Error ? err.message : 'unknown error'}`,
          )
        }
      }
    }

    return { exercises: rawExercises, errors: aiErrors }
  } catch (error) {
    reqLogger.error({ err: error }, 'AI parser failed completely')
    return {
      exercises: [],
      errors: [error instanceof Error ? error.message : 'Unknown AI error'],
    }
  }
}

/**
 * Repair common AI output issues to match our strict Zod schemas.
 */
function repairBlocks(blocks: unknown[]): unknown[] {
  return blocks.map((block) => {
    if (typeof block !== 'object' || block === null) return block
    const b = block as Record<string, unknown>

    if (!b.id || typeof b.id !== 'string') {
      b.id = generateId()
    }

    if (b.type === 'rich_text') {
      if (!b.format) b.format = 'md-math-v1'
      if (!Array.isArray(b.mediaIds)) b.mediaIds = []
      return pick(b, ['id', 'type', 'format', 'value', 'mediaIds'])
    }

    if (b.type === 'question_free_response') {
      repairInlineRichText(b, 'prompt')
      repairInlineRichText(b, 'hint')
      repairInlineRichText(b, 'solution')
      repairInlineRichText(b, 'fullSolution')

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

    if (b.type === 'latex') {
      if (!b.renderMode) b.renderMode = 'block'
      return pick(b, ['id', 'type', 'latex', 'renderMode'])
    }

    return b
  })
}

function repairInlineRichText(obj: Record<string, unknown>, field: string): void {
  const val = obj[field]
  if (!val) return
  if (typeof val === 'string') {
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

function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    if (obj[key] !== undefined) {
      result[key] = obj[key]
    }
  }
  return result
}

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

  while (diagramIdx < diagramBlocks.length) {
    result.push(diagramBlocks[diagramIdx])
    diagramIdx++
  }

  return result
}

function isDiagramPlaceholder(block: unknown): boolean {
  if (typeof block !== 'object' || block === null) return false
  const b = block as Record<string, unknown>
  if (b.type !== 'rich_text') return false
  const val = String(b.value || '').toLowerCase()
  return val.includes('[diagram]') || val.includes('[graph]') || val.includes('[tikz')
}

function splitLatexIntoExercises(latex: string): Array<{ title: string; latex: string }> {
  const docStart = latex.indexOf('\\begin{document}')
  const body = docStart >= 0 ? latex.slice(docStart) : latex

  const exercisePattern = /\\textbf\{תרגיל\s+(\d+)[^}]*\}/g
  const matches = [...body.matchAll(exercisePattern)]

  if (matches.length === 0) {
    return [{ title: '', latex: body }]
  }

  const chunks: Array<{ title: string; latex: string }> = []

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const start = match.index!
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length
    const chunkLatex = body.slice(start, end).trim()

    if (/^\\section\*?\{פתרון/.test(chunkLatex)) continue

    chunks.push({
      title: match[0].replace(/\\textbf\{|\}/g, '').trim(),
      latex: chunkLatex,
    })
  }

  return chunks.filter((c) => !c.title.includes('פתרון'))
}

function extractJsonFromResponse(text: string): Record<string, unknown> | null {
  let responseText = text.trim()

  const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)```/.exec(responseText)
  if (fenceMatch) {
    responseText = fenceMatch[1].trim()
  }

  const jsonStart = responseText.search(/[{[]/)
  if (jsonStart > 0) {
    responseText = responseText.slice(jsonStart)
  }
  if (jsonStart < 0) return null

  try {
    return JSON.parse(responseText) as Record<string, unknown>
  } catch {
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

function repairTruncatedJson(text: string): string | null {
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

  if (braces === 0 && brackets === 0) return null

  let repaired = text
  if (inString) repaired += '"'

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
- Use "md-math-v1" format for ALL rich text objects
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