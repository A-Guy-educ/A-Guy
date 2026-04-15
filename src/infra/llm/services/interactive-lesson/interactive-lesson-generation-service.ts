/**
 * Interactive lesson generation service.
 * Takes an image of a geometry problem and generates structured
 * geometry data + proof table steps using the LLM.
 *
 * Two-pass approach: LLM extracts geometry + proof, we render SVG deterministically.
 */
import type { Payload } from 'payload'
import type { AIModel, AIModelKey } from '../../models'
import { getModelRegistryEntry, getProviderModelName } from '../../models'
import { INTERACTIVE_LESSON_PROMPT } from '../../prompts/interactive-lesson-generation'
import { LLMProviderType } from '../../providers/types'
import { optimizeImageForAI } from '../image-optimizer-service'
import type {
  InteractiveLesson,
  InteractiveLessonInput,
  InteractiveLessonResponse,
} from './interactive-lesson-types'

/**
 * Generate an interactive lesson from an uploaded image.
 * Returns structured geometry data and proof steps.
 */
export async function generateInteractiveLesson(
  input: InteractiveLessonInput,
  payload: Payload,
): Promise<InteractiveLessonResponse> {
  const startTime = Date.now()
  let modelConfig: AIModel | null = null

  try {
    const { createGenkitUnifiedAdapter } = await import('../../genkit/adapters/unified-adapter')
    const adapter = await createGenkitUnifiedAdapter(payload)
    modelConfig = {
      ...resolveModelConfig('IMAGE_TO_EXERCISE'),
      // Use Gemini 2.5 Flash explicitly — 2.0 Flash produces only ~4 steps on
      // complex multi-part geometry proofs. 2.5 Flash with thinking produces 18-20.
      // The "googleai/" prefix tells the adapter to skip DB config resolution.
      name: 'googleai/gemini-2.5-flash',
      // Temperature 0 for more deterministic structured JSON output.
      temperature: 0,
      // Thinking tokens count against maxOutputTokens — budget for both.
      // Bumped to 96K to reduce mid-JSON truncation on long outputs.
      maxOutputTokens: 98304,
      thinkingBudget: 24576,
    }

    const prompt = buildPrompt(input.locale)
    const { attachmentData, sizeBytes } = await prepareImage(input)

    const result = await adapter.generateMultimodalCompletion(
      {
        prompt,
        model: modelConfig,
        attachments: [{ data: attachmentData, mimeType: input.mimeType }],
      },
      payload,
    )

    const parsed = parseResponse(result.text)

    if (parsed.error) {
      return buildErrorResponse(
        String(parsed.message || parsed.error),
        modelConfig,
        startTime,
        sizeBytes,
      )
    }

    const lesson = validateLesson(parsed, input.locale)

    return {
      success: true,
      data: lesson,
      metadata: {
        model: modelConfig.name,
        processingTimeMs: Date.now() - startTime,
        imageSizeBytes: sizeBytes,
      },
    }
  } catch (error) {
    const errorModelName = modelConfig?.name ?? 'unknown'
    return buildErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      { name: errorModelName } as AIModel,
      startTime,
      0,
    )
  }
}

function buildPrompt(locale: 'he' | 'en'): string {
  const localeInstruction =
    locale === 'he'
      ? '\n\nIMPORTANT: Generate ALL narration, claims, reasons, and explanations in Hebrew.'
      : '\n\nIMPORTANT: Generate ALL narration, claims, reasons, and explanations in English.'
  return `${INTERACTIVE_LESSON_PROMPT}${localeInstruction}`
}

async function prepareImage(input: InteractiveLessonInput) {
  if (input.mimeType === 'application/pdf') {
    return {
      attachmentData: input.imageBuffer.toString('base64'),
      sizeBytes: input.imageBuffer.length,
    }
  }
  const optimized = await optimizeImageForAI(input.imageBuffer)
  return {
    attachmentData: optimized.buffer.toString('base64'),
    sizeBytes: optimized.sizeBytes,
  }
}

/**
 * Escape unescaped backslashes before letters that aren't valid JSON escapes.
 * Gemini emits LaTeX like `\implies`, `\frac`, `\sqrt` inside JSON strings
 * without doubling the backslash, which breaks JSON.parse.
 */
function fixLatexEscapes(text: string): string {
  return text.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1')
}

function parseResponse(responseText: string): Record<string, unknown> {
  const cleaned = responseText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // Retry after fixing unescaped LaTeX backslashes
    return JSON.parse(fixLatexEscapes(cleaned))
  }
}

function validateLesson(parsed: Record<string, unknown>, locale: 'he' | 'en'): InteractiveLesson {
  const steps = Array.isArray(parsed.steps) ? parsed.steps : []
  const geo = (parsed.geometry || {}) as Record<string, unknown>

  return {
    title: typeof parsed.title === 'string' ? parsed.title : 'Untitled',
    locale,
    geometry: {
      width: typeof geo.width === 'number' ? geo.width : 400,
      height: typeof geo.height === 'number' ? geo.height : 300,
      points: Array.isArray(geo.points) ? geo.points.map(validatePoint) : [],
      segments: Array.isArray(geo.segments) ? geo.segments.map(validateSegment) : [],
      angles: Array.isArray(geo.angles) ? geo.angles.map(validateAngle) : [],
      labels: Array.isArray(geo.labels) ? geo.labels.map(validateLabel) : [],
    },
    steps: steps.map((step: Record<string, unknown>, i: number) => ({
      id: typeof step.id === 'number' ? step.id : i + 1,
      title: String(step.title || `Step ${i + 1}`),
      claim: String(step.claim || ''),
      reason: String(step.reason || ''),
      narration: String(step.narration || ''),
      explanation: String(step.explanation || ''),
      durationSeconds: typeof step.durationSeconds === 'number' ? step.durationSeconds : 5,
      highlightSegments: Array.isArray(step.highlightSegments)
        ? normalizeHighlightSegments(step.highlightSegments as unknown[])
        : [],
      highlightPoints: Array.isArray(step.highlightPoints) ? step.highlightPoints : [],
    })),
  }
}

/**
 * Gemini returns highlightSegments in varying formats:
 *   - ["AB", "CD"]          → flat strings (2+ chars = label pairs)
 *   - [["A","B"],["C","D"]] → already paired
 * Normalize to [["A","B"],["C","D"]] so the converter can match segment ids.
 */
function normalizeHighlightSegments(raw: unknown[]): string[][] {
  return raw.flatMap((item) => {
    if (Array.isArray(item) && item.length === 2) return [[String(item[0]), String(item[1])]]
    if (typeof item === 'string' && item.length >= 2) return [[item[0], item.slice(1)]]
    return []
  })
}

function validatePoint(p: Record<string, unknown>) {
  return { label: String(p.label || ''), x: Number(p.x || 0), y: Number(p.y || 0) }
}

function validateSegment(s: Record<string, unknown>) {
  // Gemini returns segments in varying formats:
  //   { from: "A", to: "B" }
  //   { p1: "A", p2: "B" }
  //   { points: ["A", "B"] }
  const pts = Array.isArray(s.points) ? s.points : []
  const from = String(s.from || s.p1 || pts[0] || '')
  const to = String(s.to || s.p2 || pts[1] || '')
  return {
    from,
    to,
    style: (['solid', 'dashed', 'bold'].includes(s.style as string) ? s.style : 'solid') as
      | 'solid'
      | 'dashed'
      | 'bold',
    color:
      typeof s.color === 'string' && !['solid', 'dashed', 'bold'].includes(s.color)
        ? s.color
        : undefined,
  }
}

function validateAngle(a: Record<string, unknown>) {
  const pts = Array.isArray(a.points) ? a.points.map(String) : ['', '', '']
  return {
    points: [pts[0], pts[1], pts[2]] as [string, string, string],
    rightAngle: a.rightAngle === true,
  }
}

function validateLabel(l: Record<string, unknown>) {
  return {
    text: String(l.text || ''),
    x: Number(l.x || 0),
    y: Number(l.y || 0),
    fontSize: Number(l.fontSize || 12),
  }
}

function resolveModelConfig(modelKey: AIModelKey): AIModel {
  return {
    name: getProviderModelName(LLMProviderType.GEMINI, modelKey),
    ...getModelRegistryEntry(modelKey),
  }
}

function buildErrorResponse(
  error: string,
  model: Pick<AIModel, 'name'>,
  startTime: number,
  sizeBytes: number,
): InteractiveLessonResponse {
  return {
    success: false,
    error,
    metadata: {
      model: model.name,
      processingTimeMs: Date.now() - startTime,
      imageSizeBytes: sizeBytes,
    },
  }
}
