/**
 * Interactive lesson generation service — GuidedExplanationV2.
 *
 * Takes an image of a math problem and returns a validated V2 payload
 * (drawing + timeline primitives) that the GuidedExplanationRunnerV2
 * executes on the client. Gemini composes the explanation from the
 * primitive vocabulary; we validate every op via Zod before returning.
 */
import type { Payload } from 'payload'
import { GuidedExplanationV2Schema } from '@/infra/contracts/guided-explanation/v2'
import type { GuidedExplanationV2 } from '@/infra/contracts/guided-explanation/v2'
import type { AIModel, AIModelKey } from '../../models'
import { getModelRegistryEntry, getProviderModelName } from '../../models'
import { INTERACTIVE_LESSON_V2_PROMPT } from '../../prompts/interactive-lesson-v2'
import { LLMProviderType } from '../../providers/types'
import { optimizeImageForAI } from '../image-optimizer-service'

export interface InteractiveLessonInput {
  imageBuffer: Buffer
  mimeType: string
  locale: 'he' | 'en'
}

export interface InteractiveLessonResponse {
  success: boolean
  data?: GuidedExplanationV2
  error?: string
  metadata: {
    model: string
    processingTimeMs: number
    imageSizeBytes: number
  }
}

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

    // Try 2.5 Flash first; fall back to Flash Lite if it times out.
    const models = [
      { name: 'googleai/gemini-2.5-flash', timeoutMs: 45_000 },
      { name: 'googleai/gemini-2.5-flash-lite', timeoutMs: 45_000 },
    ]

    let parsed: Record<string, unknown> | null = null
    for (const { name, timeoutMs } of models) {
      modelConfig = {
        ...resolveModelConfig('IMAGE_TO_EXERCISE'),
        name,
        temperature: 0,
        maxOutputTokens: 65536,
        thinkingBudget: 0,
      }

      try {
        const result = await Promise.race([
          adapter.generateMultimodalCompletion(
            {
              prompt,
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

    // Ensure version field is present (Gemini occasionally omits it)
    if (!parsed.version) parsed.version = 'guided-explanation/v2'

    // Validate against V2 schema
    const validation = GuidedExplanationV2Schema.safeParse(parsed)
    if (!validation.success) {
      const issueStr = validation.error.issues
        .slice(0, 5)
        .map((i) => `[${i.path.join('.')}] ${i.message}`)
        .join('; ')
      return buildErrorResponse(
        `LLM returned invalid payload: ${issueStr}`,
        modelConfig ?? { name: 'unknown', temperature: 0, maxOutputTokens: 0 },
        startTime,
        sizeBytes,
      )
    }

    return {
      success: true,
      data: validation.data,
      metadata: {
        model: modelConfig?.name ?? 'unknown',
        processingTimeMs: Date.now() - startTime,
        imageSizeBytes: sizeBytes,
      },
    }
  } catch (error) {
    return buildErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      modelConfig ?? { name: 'unknown', temperature: 0, maxOutputTokens: 0 },
      startTime,
      0,
    )
  }
}

async function buildPrompt(locale: 'he' | 'en', payload: Payload): Promise<string> {
  let basePrompt = INTERACTIVE_LESSON_V2_PROMPT
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
      ? '\n\nIMPORTANT: Generate ALL narration, text, and titles in Hebrew.'
      : '\n\nIMPORTANT: Generate ALL narration, text, and titles in English.'
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
