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
    // Extract content between ```json...``` or ```...``` fences
    const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)```/.exec(responseText)
    if (fenceMatch) {
      responseText = fenceMatch[1].trim()
    }
    // Find first { or [ if there's leading text
    const jsonStart = responseText.search(/[{[]/)
    if (jsonStart > 0) {
      responseText = responseText.slice(jsonStart)
    }

    let exercises: Array<{ title: string; blocks: unknown[] }>
    try {
      const parsed = JSON.parse(responseText)
      exercises = Array.isArray(parsed.exercises) ? parsed.exercises : [parsed]
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
    for (let i = 0; i < exercises.length; i++) {
      const group = exercises[i]
      const exercise = await payload.create({
        collection: 'exercises',
        data: {
          lesson: lessonId,
          title: group.title || undefined,
          content: { blocks: group.blocks },
          origin: 'import',
          order: startOrder + i,
        },
        draft: true,
      })
      createdIds.push(exercise.id)
    }

    reqLogger.info({ lessonId, count: createdIds.length }, 'Exercises created from AI LaTeX import')

    return NextResponse.json({
      success: true,
      data: { exerciseIds: createdIds, exerciseCount: createdIds.length },
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

## Rules
- Use "md-math-v1" format for all rich text
- Wrap inline math with $...$ and block math with $$...$$
- Convert Hebrew text as-is
- Each sub-question (א, ב, ג, etc.) should be a separate question block
- If a question has multiple choice options, use question_select with variant "mcq"
- If a question requires a free-form answer, use question_free_response
- Tables (\\begin{tabular}) become question_table blocks
- Skip TikZ diagrams (geometry/graphs) — just mention them in a rich_text note
- Skip preamble, \\documentclass, \\usepackage, etc.
- Skip solution sections
- Return ONLY valid JSON, no markdown fences or explanatory text`

  const userMessage = `Convert this LaTeX into exercise blocks JSON:\n\n${latex}`

  return { system, userMessage }
}
