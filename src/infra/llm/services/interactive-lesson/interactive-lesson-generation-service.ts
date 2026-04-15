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
 *
 * Three-tier retry:
 *   1. Gemini 2.5 Flash (moderate thinking budget 4K) — best quality
 *   2. Gemini 2.5 Flash Lite (no thinking) — fast fallback
 *   3. Flash Lite + brevity addendum — catches MAX_TOKENS truncation
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
    const prompt = await buildPrompt(input.locale, payload)
    const { attachmentData, sizeBytes } = await prepareImage(input)

    const BREVITY_ADDENDUM =
      '\n\nCRITICAL: Your previous attempt was too long. Generate a MUCH shorter response: fewer geometry points, maximum 8 steps, narration under 100 chars per step. Be radically concise.'

    const attempts = [
      // Flash with moderate thinking — quality but bounded
      { name: 'googleai/gemini-2.5-flash', timeoutMs: 45_000, thinking: 4096, extra: '' },
      // Flash Lite fallback (no thinking) — fast, no loops
      { name: 'googleai/gemini-2.5-flash-lite', timeoutMs: 45_000, thinking: 0, extra: '' },
      // Flash Lite + brevity — catches MAX_TOKENS truncation
      {
        name: 'googleai/gemini-2.5-flash-lite',
        timeoutMs: 45_000,
        thinking: 0,
        extra: BREVITY_ADDENDUM,
      },
    ]

    let parsed: Record<string, unknown> | null = null
    for (const { name, timeoutMs, thinking, extra } of attempts) {
      modelConfig = {
        ...resolveModelConfig('IMAGE_TO_EXERCISE'),
        name,
        temperature: 0,
        maxOutputTokens: 65536,
        thinkingBudget: thinking,
      }

      try {
        const result = await Promise.race([
          adapter.generateMultimodalCompletion(
            {
              prompt: prompt + extra,
              model: modelConfig,
              attachments: [{ data: attachmentData, mimeType: input.mimeType }],
            },
            payload,
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs),
          ),
        ])

        parsed = parseResponse(result.text)
        if (!parsed.error) break
        // Retry on truncation/empty; bail on other errors (IMAGE_UNCLEAR, NOT_MATH)
        if (parsed.error !== 'PARSE_ERROR' && parsed.error !== 'EMPTY_RESPONSE') break
      } catch (err) {
        const isTimeout = err instanceof Error && err.message === 'TIMEOUT'
        if (!isTimeout) throw err
      }
    }

    if (!parsed || parsed.error) {
      return buildErrorResponse(
        String(parsed?.message || parsed?.error || 'Generation timed out'),
        modelConfig ?? { name: 'unknown', temperature: 0, maxOutputTokens: 0 },
        startTime,
        sizeBytes,
      )
    }

    const lesson = validateLesson(parsed, input.locale)

    return {
      success: true,
      data: lesson,
      metadata: {
        model: modelConfig?.name ?? 'unknown',
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

async function buildPrompt(locale: 'he' | 'en', payload: Payload): Promise<string> {
  // Look up a published interactive_lesson prompt from the admin Prompts
  // collection, fall back to the hardcoded default.
  let basePrompt = INTERACTIVE_LESSON_PROMPT
  try {
    const result = await payload.find({
      collection: 'prompts',
      where: {
        usage: { equals: 'interactive_lesson' },
        status: { equals: 'published' },
      },
      limit: 1,
      overrideAccess: true,
    })
    if (result.docs.length > 0 && result.docs[0].template) {
      basePrompt = result.docs[0].template
    }
  } catch {
    /* fall through to default */
  }
  const localeInstruction =
    locale === 'he'
      ? '\n\nIMPORTANT: Generate ALL narration, claims, reasons, and explanations in Hebrew.'
      : '\n\nIMPORTANT: Generate ALL narration, claims, reasons, and explanations in English.'
  return `${basePrompt}${localeInstruction}`
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
 * without doubling the backslash, which breaks JSON.parse. Valid JSON
 * escapes are \", \\, \/, \b, \f, \n, \r, \t, \uXXXX — anything else needs
 * its backslash doubled.
 */
function fixLatexEscapes(text: string): string {
  return text.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1')
}

function parseResponse(responseText: string): Record<string, unknown> {
  if (!responseText || responseText.trim().length === 0) {
    return { error: 'EMPTY_RESPONSE', message: 'LLM returned an empty response.' }
  }
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
    try {
      return JSON.parse(fixLatexEscapes(cleaned))
    } catch {
      return { error: 'PARSE_ERROR', message: 'LLM returned malformed JSON. Please try again.' }
    }
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
 *   - ["AB", "CD"]              → 2+ char strings = label pairs
 *   - [["A","B"],["C","D"]]    → already paired arrays
 *   - ["A","B","C","D"]         → flat single-char labels = consecutive pairs
 * Normalize to [["A","B"],["C","D"]] so the converter can match segment ids.
 */
function normalizeHighlightSegments(raw: unknown[]): string[][] {
  if (raw.length > 0 && Array.isArray(raw[0])) {
    return raw
      .filter((item) => Array.isArray(item) && item.length === 2)
      .map((item) => [(item as string[])[0], (item as string[])[1]])
  }
  if (raw.length > 0 && typeof raw[0] === 'string' && (raw[0] as string).length >= 2) {
    return raw
      .filter((item) => typeof item === 'string' && (item as string).length >= 2)
      .map((item) => [(item as string)[0], (item as string).slice(1)])
  }
  const pairs: string[][] = []
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const a = String(raw[i])
    const b = String(raw[i + 1])
    if (a.length === 1 && b.length === 1) pairs.push([a, b])
  }
  return pairs
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
    color: ['blue', 'red', 'green', 'orange', 'purple'].includes(s.color as string)
      ? (s.color as string)
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
