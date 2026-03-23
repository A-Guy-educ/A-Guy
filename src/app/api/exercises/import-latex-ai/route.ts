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
    }

    const { system, userMessage } = buildAiParserPrompt(latex)

    const result = await adapter.generateChatCompletion(
      {
        system,
        messages: [{ role: 'user', content: userMessage }],
        model: modelConfig,
        acknowledgment: 'Parsing LaTeX into exercise blocks.',
      },
      payload,
    )

    // Extract JSON from AI response — handle markdown code fences and leading text
    let responseText = result.text.trim()
    const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)```/.exec(responseText)
    if (fenceMatch) {
      responseText = fenceMatch[1].trim()
    }
    const jsonStart = responseText.search(/[{[]/)
    if (jsonStart > 0) {
      responseText = responseText.slice(jsonStart)
    }

    let rawExercises: Array<{ title: string; blocks: unknown[] }>
    try {
      const aiOutput = JSON.parse(responseText)
      rawExercises = Array.isArray(aiOutput.exercises) ? aiOutput.exercises : [aiOutput]
    } catch {
      reqLogger.error(
        { responsePreview: responseText.slice(0, 500) },
        'AI returned invalid JSON for LaTeX import',
      )
      return NextResponse.json(
        { success: false, error: 'AI returned invalid JSON. Try the script import instead.' },
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

      // Ensure answer has acceptedAnswers
      if (b.answer && typeof b.answer === 'object') {
        const ans = b.answer as Record<string, unknown>
        if (!Array.isArray(ans.acceptedAnswers)) {
          ans.acceptedAnswers = ['']
        }
        b.answer = pick(ans, ['acceptedAnswers'])
      } else {
        b.answer = { acceptedAnswers: [''] }
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

function buildAiParserPrompt(latex: string): { system: string; userMessage: string } {
  const system = `You are an expert at converting LaTeX math exercises into structured JSON content blocks.

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
- Skip TikZ diagrams (geometry/graphs) — just mention them in a rich_text note
- Skip preamble, \\documentclass, \\usepackage, etc.
- Skip solution sections
- Return ONLY valid JSON — no markdown fences, no comments, no explanatory text`

  const userMessage = `Convert this LaTeX into exercise blocks JSON:\n\n${latex}`

  return { system, userMessage }
}
