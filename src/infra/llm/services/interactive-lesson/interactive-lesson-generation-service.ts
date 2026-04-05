/**
 * Interactive lesson generation service.
 * Takes an image of a math problem and generates structured
 * step-by-step HTML animation data using the LLM.
 *
 * Uses Genkit unified adapter (same pattern as data-extractor-service).
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
 * Returns structured step data with HTML content and narration.
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
    modelConfig = resolveModelConfig('IMAGE_TO_EXERCISE')

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
      ? '\n\nIMPORTANT: Generate ALL narration and titles in Hebrew.'
      : '\n\nIMPORTANT: Generate ALL narration and titles in English.'
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

function parseResponse(responseText: string): Record<string, unknown> {
  const cleaned = responseText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()
  return JSON.parse(cleaned)
}

function validateLesson(parsed: Record<string, unknown>, locale: 'he' | 'en'): InteractiveLesson {
  const steps = Array.isArray(parsed.steps) ? parsed.steps : []
  return {
    title: typeof parsed.title === 'string' ? parsed.title : 'Untitled',
    locale,
    steps: steps.map((step: Record<string, unknown>, index: number) => ({
      id: typeof step.id === 'number' ? step.id : index + 1,
      title: String(step.title || `Step ${index + 1}`),
      narration: String(step.narration || ''),
      htmlContent: String(step.htmlContent || ''),
      durationSeconds: typeof step.durationSeconds === 'number' ? step.durationSeconds : 5,
    })),
    globalStyles: typeof parsed.globalStyles === 'string' ? parsed.globalStyles : '',
  }
}

function resolveModelConfig(modelKey: AIModelKey): AIModel {
  const entry = getModelRegistryEntry(modelKey)
  return {
    name: getProviderModelName(LLMProviderType.GEMINI, modelKey),
    ...entry,
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
