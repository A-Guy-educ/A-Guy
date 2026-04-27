/**
 * Interactive lesson generation service.
 * Takes an image of a geometry problem and generates structured
 * geometry data + proof table steps using the LLM.
 *
 * Two-pass approach: LLM extracts geometry + proof, we render SVG deterministically.
 */
import type { Payload } from 'payload'
import { z } from 'zod'
import type { AIModel } from '../../models'
import { getCircuitBreaker } from '../../providers/shared/circuit-breaker'
import { withRetry } from '../../providers/shared/retry'
import { withTimeout } from '../../providers/shared/timeout'
import { logger } from '@/infra/utils/logger/logger'
import { synthesizeSpeech } from '@/server/services/tts/google-cloud-tts'
import { optimizeImageForAI } from '../image-optimizer-service'
import { InteractiveLessonResponseSchema } from './interactive-lesson-schema'
import { getPublishedInteractiveLessonPrompt } from './published-prompt-cache'
import type {
  InteractiveLesson,
  InteractiveLessonInput,
  InteractiveLessonPromptSource,
  InteractiveLessonResponse,
} from './interactive-lesson-types'

// Single source of truth for the Gemini call config. Used for both the API
// request and metadata reporting so they can't diverge.
const GEMINI_CONFIG = {
  modelName: 'gemini-2.5-flash',
  temperature: 0,
  maxOutputTokens: 98304,
  thinkingBudget: 24576,
  timeoutMs: 180_000,
  maxRetries: 2,
} as const

const circuitBreaker = getCircuitBreaker('interactive-lesson-gemini')

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
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

    modelConfig = {
      name: `googleai/${GEMINI_CONFIG.modelName}`,
      temperature: GEMINI_CONFIG.temperature,
      maxOutputTokens: GEMINI_CONFIG.maxOutputTokens,
      thinkingBudget: GEMINI_CONFIG.thinkingBudget,
    }

    const { prompt, promptSource } = await buildPrompt(input.locale, payload)
    const { attachmentData, sizeBytes } = await prepareImage(input)

    // Direct Gemini call with responseSchema so the model is constrained to
    // produce exactly the shape we expect. Wrapped in the same reliability
    // primitives the Genkit adapter uses (timeout + retry + circuit breaker)
    // so a transient 5xx/429 doesn't fail the user's request on first try.
    const responseText = await circuitBreaker.execute(() =>
      withRetry(
        () =>
          withTimeout(
            () =>
              callGeminiWithSchema({
                apiKey,
                prompt,
                attachmentData,
                attachmentMimeType: input.mimeType,
              }),
            { timeoutMs: GEMINI_CONFIG.timeoutMs, message: 'Gemini request timed out' },
          ),
        {
          maxRetries: GEMINI_CONFIG.maxRetries,
          isRetryable: isRetryableGeminiError,
          logPrefix: '[InteractiveLesson]',
        },
      ),
    )

    const parsed = parseResponse(responseText)

    if (parsed.error) {
      return buildErrorResponse(
        String(parsed.message || parsed.error),
        modelConfig,
        startTime,
        sizeBytes,
      )
    }

    const lessonRaw = validateLesson(parsed, input.locale)

    // Bake narration audio into the lesson so the cache stores not just the
    // primitives but the spoken audio too. Per-step TTS failures are
    // non-fatal — those steps fall through to live cloud TTS at playback time.
    // Returns a new lesson rather than mutating in place; the original is
    // discarded.
    const lesson = await attachStepAudio(lessonRaw, input.locale, payload)

    return {
      success: true,
      data: lesson,
      metadata: {
        model: modelConfig.name,
        processingTimeMs: Date.now() - startTime,
        imageSizeBytes: sizeBytes,
      },
      promptSource,
    }
  } catch (error) {
    const errorModelName = modelConfig?.name ?? 'unknown'
    // Special-case: missing prompt is an admin-config issue, not something
    // the student can fix. The internal message includes admin-only
    // instructions ("set up a Prompts row with usage=...") which we do
    // NOT want to render to a student. Log the detail server-side and
    // return a generic localized fallback that the chat-fallback card
    // can pair with its "ask in chat instead" affordance.
    if (error instanceof InteractiveLessonPromptMissingError) {
      logger.error(
        { err: error },
        '[InteractiveLesson] Admin has not configured the interactive_lesson prompt; generation cannot proceed',
      )
      return buildErrorResponse(
        userFacingMissingPromptMessage(input.locale),
        { name: errorModelName } as AIModel,
        startTime,
        0,
      )
    }
    return buildErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      { name: errorModelName } as AIModel,
      startTime,
      0,
    )
  }
}

/**
 * Generic, locale-aware message for the missing-prompt state. Hides the
 * admin instructions in the InteractiveLessonPromptMissingError from the
 * student bubble; the actionable detail is in the server logs.
 */
function userFacingMissingPromptMessage(locale: 'he' | 'en'): string {
  return locale === 'he'
    ? 'יצירת השיעור החזותי אינה זמינה כרגע. אפשר עדיין לשאול על התמונה הזו בצ׳אט.'
    : 'Visual lesson generation is temporarily unavailable. You can still ask about this image in the chat.'
}

/**
 * Build the Gemini prompt by loading the base template strictly from the
 * admin Prompts collection. There is no hardcoded fallback — if no published
 * prompt with usage="interactive_lesson" exists, generation fails with a
 * clear admin-facing error so the missing-config state can't silently
 * regress to a stale built-in copy.
 */
async function buildPrompt(
  locale: 'he' | 'en',
  payload: Payload,
): Promise<{ prompt: string; promptSource: InteractiveLessonPromptSource }> {
  const published = await getPublishedInteractiveLessonPrompt(payload)
  if (!published) {
    throw new InteractiveLessonPromptMissingError()
  }

  const localeInstruction =
    locale === 'he'
      ? '\n\nIMPORTANT: Generate ALL narration, claims, reasons, and explanations in Hebrew.'
      : '\n\nIMPORTANT: Generate ALL narration, claims, reasons, and explanations in English.'
  return {
    prompt: `${published.template}${localeInstruction}`,
    promptSource: {
      id: published.id,
      updatedAt: published.updatedAt,
    },
  }
}

/**
 * Sentinel error for missing-prompt configuration. Caught by the outer
 * generation handler and surfaced as a clean error response to the client
 * with an admin-facing message.
 */
class InteractiveLessonPromptMissingError extends Error {
  constructor() {
    super(
      'No published "Interactive Lesson" prompt is configured. Set one up in the admin Prompts collection (usage = "interactive_lesson", status = "published") before generating lessons.',
    )
    this.name = 'InteractiveLessonPromptMissingError'
  }
}

/**
 * Custom error that carries the HTTP status so withRetry can decide
 * whether to retry based on the code (5xx/429 yes, 4xx no).
 */
class GeminiApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'GeminiApiError'
  }
}

function isRetryableGeminiError(err: Error): boolean {
  if (err instanceof GeminiApiError) {
    return err.status >= 500 || err.status === 429
  }
  // Timeouts and network errors are retryable
  return err.name === 'TimeoutError' || err.message.includes('fetch failed')
}

/**
 * Call Gemini 2.5 Flash directly with a responseSchema constraint.
 *
 * We bypass the Genkit adapter to pass responseSchema to Gemini's v1beta
 * generateContent endpoint — the model is then forced to produce JSON
 * matching our exact shape, eliminating field-name variations (id vs
 * label, p1 vs from, etc.) at the source. Timeout/retry/circuit-breaker
 * are applied by the caller.
 */
async function callGeminiWithSchema(args: {
  apiKey: string
  prompt: string
  attachmentData: string
  attachmentMimeType: string
}): Promise<string> {
  const schemaForGemini = zodToGeminiSchema(InteractiveLessonResponseSchema)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.modelName}:generateContent?key=${args.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: args.attachmentMimeType, data: args.attachmentData } },
              { text: args.prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: GEMINI_CONFIG.temperature,
          maxOutputTokens: GEMINI_CONFIG.maxOutputTokens,
          thinkingConfig: { thinkingBudget: GEMINI_CONFIG.thinkingBudget },
          responseMimeType: 'application/json',
          responseSchema: schemaForGemini,
        },
      }),
    },
  )

  if (!res.ok) {
    // Log the raw body server-side for debugging, but don't include it in
    // the thrown error message so nothing leaks upstream.
    const body = await res.text()
    logger.error({ status: res.status, body: body.slice(0, 500) }, 'Gemini API error')
    throw new GeminiApiError(res.status, `Gemini API returned ${res.status}`)
  }

  const json = await res.json()
  const text =
    json.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string }) => p.text)
      ?.map((p: { text: string }) => p.text)
      ?.join('') || ''
  return text
}

/**
 * Convert a Zod schema to the OpenAPI 3.0 subset Gemini's responseSchema
 * accepts. Strips $schema and additionalProperties recursively — both
 * are in JSON Schema but rejected by Gemini's endpoint.
 */
function zodToGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>
  return stripUnsupportedKeys(jsonSchema) as Record<string, unknown>
}

function stripUnsupportedKeys(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupportedKeys)
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) {
      if (k === '$schema' || k === 'additionalProperties') continue
      out[k] = stripUnsupportedKeys(v)
    }
    return out
  }
  return node
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
  const graph = parsed.graph as Record<string, unknown> | undefined
  // A graph scene is worth rendering if EITHER plots or markers are
  // populated. Marker-only graphs are valid for problems that ask the
  // student to identify specific points on a coordinate plane (e.g.
  // "find the intersections at A, B, C") where there's no curve to plot.
  const hasGraphContent =
    !!graph &&
    ((Array.isArray(graph.plots) && (graph.plots as unknown[]).length > 0) ||
      (Array.isArray(graph.markers) && (graph.markers as unknown[]).length > 0))
  const numberLine = parsed.numberLine as Record<string, unknown> | undefined
  const hasNumberLineContent =
    !!numberLine &&
    ((Array.isArray(numberLine.intervals) && (numberLine.intervals as unknown[]).length > 0) ||
      (Array.isArray(numberLine.marks) && (numberLine.marks as unknown[]).length > 0))

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
    graph: hasGraphContent ? validateGraph(graph) : undefined,
    numberLine: hasNumberLineContent ? validateNumberLine(numberLine) : undefined,
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
      highlightPlots: Array.isArray(step.highlightPlots)
        ? (step.highlightPlots as unknown[]).map(String)
        : [],
      highlightMarkers: Array.isArray(step.highlightMarkers)
        ? (step.highlightMarkers as unknown[]).map(String)
        : [],
      highlightMarks: Array.isArray(step.highlightMarks)
        ? (step.highlightMarks as unknown[]).map(String)
        : [],
      highlightIntervals: Array.isArray(step.highlightIntervals)
        ? (step.highlightIntervals as unknown[]).map(String)
        : [],
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

const GRAPH_COLORS = ['blue', 'red', 'green', 'orange', 'purple'] as const
type GraphColor = (typeof GRAPH_COLORS)[number]

function toGraphColor(value: unknown): GraphColor | undefined {
  return typeof value === 'string' && (GRAPH_COLORS as readonly string[]).includes(value)
    ? (value as GraphColor)
    : undefined
}

function toRange(value: unknown, fallback: [number, number]): [number, number] {
  if (Array.isArray(value) && value.length === 2) {
    const a = Number(value[0])
    const b = Number(value[1])
    if (Number.isFinite(a) && Number.isFinite(b)) return [a, b]
  }
  return fallback
}

function validatePlot(p: Record<string, unknown>, i: number) {
  const rawPoints = Array.isArray(p.points) ? p.points : []
  const points: Array<[number, number]> = rawPoints.flatMap((pt) => {
    if (Array.isArray(pt) && pt.length >= 2) {
      const x = Number(pt[0])
      const y = Number(pt[1])
      if (Number.isFinite(x) && Number.isFinite(y)) return [[x, y] as [number, number]]
    }
    return []
  })
  return {
    id: String(p.id || `plot-${i + 1}`),
    points,
    color: toGraphColor(p.color),
    style: p.style === 'dashed' ? ('dashed' as const) : ('solid' as const),
    label: typeof p.label === 'string' ? p.label : undefined,
  }
}

function validateMarker(m: Record<string, unknown>, i: number) {
  return {
    id: String(m.id || `marker-${i + 1}`),
    x: Number(m.x || 0),
    y: Number(m.y || 0),
    label: typeof m.label === 'string' ? m.label : undefined,
    color: toGraphColor(m.color),
  }
}

function validateGraph(g: Record<string, unknown>) {
  return {
    xRange: toRange(g.xRange, [-10, 10]),
    yRange: toRange(g.yRange, [-10, 10]),
    xStep: typeof g.xStep === 'number' && g.xStep > 0 ? g.xStep : undefined,
    yStep: typeof g.yStep === 'number' && g.yStep > 0 ? g.yStep : undefined,
    plots: Array.isArray(g.plots) ? g.plots.map(validatePlot) : [],
    markers: Array.isArray(g.markers) ? g.markers.map(validateMarker) : [],
  }
}

const INCLUSION_OPTIONS = ['open', 'closed'] as const
const INTERVAL_INCLUSION_OPTIONS = ['open', 'closed', 'unbounded'] as const
type NumberLineMarkInclusion = (typeof INCLUSION_OPTIONS)[number]
type NumberLineIntervalInclusion = (typeof INTERVAL_INCLUSION_OPTIONS)[number]

function toMarkInclusion(value: unknown): NumberLineMarkInclusion | undefined {
  return typeof value === 'string' && (INCLUSION_OPTIONS as readonly string[]).includes(value)
    ? (value as NumberLineMarkInclusion)
    : undefined
}

function toIntervalInclusion(value: unknown): NumberLineIntervalInclusion {
  return typeof value === 'string' &&
    (INTERVAL_INCLUSION_OPTIONS as readonly string[]).includes(value)
    ? (value as NumberLineIntervalInclusion)
    : 'closed'
}

function validateNumberLineMark(m: Record<string, unknown>, i: number) {
  return {
    id: String(m.id || `mark-${i + 1}`),
    value: Number(m.value || 0),
    label: typeof m.label === 'string' ? m.label : undefined,
    inclusion: toMarkInclusion(m.inclusion),
    color: toGraphColor(m.color),
  }
}

function validateNumberLineInterval(iv: Record<string, unknown>, i: number) {
  return {
    id: String(iv.id || `interval-${i + 1}`),
    from: Number(iv.from || 0),
    to: Number(iv.to || 0),
    fromInclusion: toIntervalInclusion(iv.fromInclusion),
    toInclusion: toIntervalInclusion(iv.toInclusion),
    color: toGraphColor(iv.color),
    label: typeof iv.label === 'string' ? iv.label : undefined,
  }
}

function validateNumberLine(nl: Record<string, unknown>) {
  return {
    range: toRange(nl.range, [-10, 10]),
    step: typeof nl.step === 'number' && nl.step > 0 ? nl.step : undefined,
    marks: Array.isArray(nl.marks) ? nl.marks.map(validateNumberLineMark) : [],
    intervals: Array.isArray(nl.intervals) ? nl.intervals.map(validateNumberLineInterval) : [],
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

/**
 * Per-step base64 cap. A typical TTS narration runs 30–60KB; 600KB allows
 * unusually long narrations through but bounds individual rows.
 */
const MAX_STEP_AUDIO_BASE64_BYTES = 600_000

/**
 * How many TTS calls to have in flight at once. Google Cloud TTS rate-limits
 * by request rate; 4 in flight is a comfortable middle ground that keeps
 * 8-step lessons effectively parallel while stopping a 25-step lesson from
 * firing 25 simultaneous requests and tripping 429s.
 *
 * Named without "CONCURRENCY_LIMIT" because the project-wide guardrail in
 * tests/unit/mongodb-pool-config.test.ts enforces that constant against
 * the Mongo pool size — but this limit governs HTTP requests to Google
 * Cloud TTS, not DB connections, so the pool-size constraint doesn't apply.
 */
const TTS_PARALLEL_REQUESTS = 4

/**
 * Promise.allSettled-equivalent that runs at most `limit` workers
 * concurrently. Preserves input order in the result array.
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length)
  let nextIndex = 0
  const runOne = async (): Promise<void> => {
    while (true) {
      const i = nextIndex
      nextIndex += 1
      if (i >= items.length) return
      try {
        const value = await worker(items[i], i)
        results[i] = { status: 'fulfilled', value }
      } catch (reason) {
        results[i] = { status: 'rejected', reason }
      }
    }
  }
  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runOne()))
  return results
}

/**
 * Per-LESSON running budget for cached audio bytes. The per-step cap alone
 * isn't enough — Gemini occasionally emits 20+ steps for a multi-part
 * problem, and 25 × 600KB = 15MB would breach Mongo's 16MB document limit.
 * The persist failure would silently swallow into the .catch in the
 * endpoint and the user would re-pay Gemini on every reload.
 *
 * 8MB leaves 8MB of headroom for the lesson JSON, generationMetadata,
 * promptId/promptUpdatedAt, indexes, and Mongo overhead. Steps past the
 * budget skip caching and fall through to live TTS at playback (same path
 * as per-step failures and oversized blobs).
 */
const MAX_LESSON_AUDIO_BASE64_BYTES = 8_000_000

/**
 * Returns a new lesson with TTS audio attached per step. Steps with no
 * narration text are skipped. Per-step TTS failures and oversized audio
 * blobs are logged and dropped — those steps fall through to live cloud
 * TTS at playback time. Runs all step calls in parallel to keep the
 * up-front generation cost bounded.
 *
 * Returns a fresh lesson object (steps array + step entries replaced)
 * rather than mutating the input — keeps the caching write deterministic
 * and consistent with the project's immutability rule.
 */
async function attachStepAudio(
  lesson: InteractiveLesson,
  locale: 'he' | 'en',
  payload: Payload,
): Promise<InteractiveLesson> {
  const stepsToSpeak = lesson.steps
    .map((step, index) => ({ step, index, text: (step.narration || '').trim() }))
    .filter(({ text }) => text.length > 0)

  if (stepsToSpeak.length === 0) return lesson

  const audioStartTime = Date.now()
  // Cap concurrent TTS calls. Unbounded Promise.allSettled would fire all
  // 12+ steps' calls at once and risk Google TTS 429s on long lessons. The
  // generation latency budget already absorbs sequential audio; modest
  // parallelism is fine, full parallelism is rate-limit risk for no
  // user-visible perf gain.
  const results = await runWithConcurrencyLimit(stepsToSpeak, TTS_PARALLEL_REQUESTS, ({ text }) =>
    synthesizeSpeech(text, locale, payload),
  )

  // Map step index → audioBase64 (or null if it failed / was oversized).
  // We attach in original step order so the early steps get cached first
  // — students typically rewatch from the start, so prioritizing earlier
  // steps when the per-lesson budget runs out is the right tradeoff.
  const audioByIndex = new Map<number, string>()
  let attached = 0
  let failed = 0
  let oversized = 0
  let budgetExceeded = 0
  let runningBytes = 0
  results.forEach((res, i) => {
    const { step, index } = stepsToSpeak[i]
    if (res.status === 'rejected') {
      failed += 1
      logger.warn(
        { err: res.reason, stepId: step.id },
        '[InteractiveLesson] TTS failed for step; will fall back at playback',
      )
      return
    }
    const audio = res.value
    if (!audio) {
      failed += 1
      return
    }
    if (audio.length > MAX_STEP_AUDIO_BASE64_BYTES) {
      oversized += 1
      logger.warn(
        { stepId: step.id, sizeBytes: audio.length, capBytes: MAX_STEP_AUDIO_BASE64_BYTES },
        '[InteractiveLesson] TTS audio exceeds per-step cap, skipping cache; will fall back at playback',
      )
      return
    }
    if (runningBytes + audio.length > MAX_LESSON_AUDIO_BASE64_BYTES) {
      budgetExceeded += 1
      logger.warn(
        {
          stepId: step.id,
          sizeBytes: audio.length,
          runningBytes,
          budgetBytes: MAX_LESSON_AUDIO_BASE64_BYTES,
        },
        '[InteractiveLesson] Per-lesson audio budget exhausted, skipping cache for this step; will fall back at playback',
      )
      return
    }
    audioByIndex.set(index, audio)
    runningBytes += audio.length
    attached += 1
  })

  // Build a fresh steps array — only mutate the entries that actually got
  // audio, leave the rest untouched (still no audioBase64, fallback path
  // kicks in client-side).
  const nextSteps = lesson.steps.map((step, index) => {
    const audio = audioByIndex.get(index)
    return audio ? { ...step, audioBase64: audio } : step
  })

  logger.info(
    {
      totalSteps: lesson.steps.length,
      attached,
      failed,
      oversized,
      budgetExceeded,
      runningBytes,
      durationMs: Date.now() - audioStartTime,
    },
    '[InteractiveLesson] Step audio baked into lesson',
  )

  return { ...lesson, steps: nextSteps }
}
