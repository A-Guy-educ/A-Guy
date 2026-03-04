/**
 * Data extraction service using AI models
 * Extracts structured data from images (questions, options, answers)
 *
 * Migrated to Genkit unified adapter for LLM operations.
 * Uses dynamic imports to prevent Node.js-only modules from being bundled into client code.
 */
import type { Payload } from 'payload'
import type { AIModel, AIModelKey } from '../models'
import { getModelRegistryEntry, getProviderModelName } from '../models'
import { SIMPLE_TEXT_QUESTION_PROMPT } from '../prompts/simple-text-question'
import { V3_EXERCISE_WITH_DIAGRAMS_PROMPT } from '../prompts/v3-exercise-with-diagrams'
import { LLMProviderType } from '../providers/types'
import { optimizeImageForAI } from './image-optimizer-service'

export interface ImageToExerciseInput {
  imageBuffer: Buffer
  mimeType: string
}

export interface ImageToExerciseResult {
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string
}

export interface ExtendedExtractionResult extends ImageToExerciseResult {
  diagramDescription?: string
  diagramPosition?: 'before_question' | 'after_question'
}

export interface ImageToExerciseResponse {
  success: boolean
  data?: ImageToExerciseResult
  error?: string
  metadata: {
    model: string
    processingTimeMs: number
    imageSizeBytes: number
  }
}

/**
 * Extract structured exercise data from an uploaded image
 * Returns basic question/options/answer structure
 *
 * Uses provider factory for model selection, supporting multiple AI providers.
 */
export async function extractFromImage(
  input: ImageToExerciseInput,
  payload: Payload,
): Promise<ImageToExerciseResponse> {
  const startTime = Date.now()
  let modelConfig: AIModel | null = null

  try {
    // Dynamic import to prevent Node.js-only modules from being bundled into client code
    const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
    const adapter = await createGenkitUnifiedAdapter(payload)
    modelConfig = resolveModelConfig('IMAGE_TO_EXERCISE')

    // Prepare multimodal input
    const prompt = `${SIMPLE_TEXT_QUESTION_PROMPT}\n\nExtract the question, options (A, B, C, D), correct answer, and explanation from this image. Return JSON with: question, options[], correctAnswer (index), explanation(optional).`

    // For PDFs, pass directly to Gemini (it handles PDF natively)
    // For images, optimize before sending to reduce API latency/costs
    let attachmentData: string
    let sizeBytes: number

    if (input.mimeType === 'application/pdf') {
      attachmentData = input.imageBuffer.toString('base64')
      sizeBytes = input.imageBuffer.length
    } else {
      const optimizedImage = await optimizeImageForAI(input.imageBuffer)
      attachmentData = optimizedImage.buffer.toString('base64')
      sizeBytes = optimizedImage.sizeBytes
    }

    // Generate content using Genkit adapter
    const result = await adapter.generateMultimodalCompletion(
      {
        prompt,
        model: modelConfig,
        attachments: [
          {
            data: attachmentData,
            mimeType: input.mimeType,
          },
        ],
      },
      payload,
    )

    const responseText = result.text.trim()

    // Clean JSON response (remove markdown code blocks if present)
    const cleanedText = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim()

    // Parse JSON
    const parsed = JSON.parse(cleanedText)

    // Check for errors from AI
    if (parsed.error) {
      return {
        success: false,
        error: parsed.error,
        metadata: {
          model: modelConfig.name,
          processingTimeMs: Date.now() - startTime,
          imageSizeBytes: sizeBytes,
        },
      }
    }

    // Return successful result
    return {
      success: true,
      data: {
        question: parsed.question,
        options: parsed.options,
        correctAnswer: parsed.correctAnswer,
        explanation: parsed.explanation,
      },
      metadata: {
        model: modelConfig.name,
        processingTimeMs: Date.now() - startTime,
        imageSizeBytes: sizeBytes,
      },
    }
  } catch (error) {
    // Handle any errors during processing
    // Use default model name for error reporting if modelConfig is not available
    const errorModelName = modelConfig?.name ?? getDefaultModelName()
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      metadata: {
        model: errorModelName,
        processingTimeMs: Date.now() - startTime,
        imageSizeBytes: 0,
      },
    }
  }
}

/**
 * Resolve model config from MODEL_REGISTRY (mirrors getProviderModelConfig)
 */
function resolveModelConfig(modelKey: AIModelKey): AIModel {
  const entry = getModelRegistryEntry(modelKey)
  return {
    name: getProviderModelName(LLMProviderType.GEMINI, modelKey),
    ...entry,
  }
}

/**
 * Get default model name when config is not available
 */
function getDefaultModelName(): string {
  return 'gemini-2.0-flash-001' // Default fallback
}

/**
 * Normalize LLM response to multi-part exercise format.
 * Handles both new format (stem + subQuestions) and old format (question + options).
 */
function normalizeToMultiPart(
  parsed: Record<string, unknown>,
  diagramDescription?: string,
  diagramPosition?: 'before_question' | 'after_question',
): MultiPartExtractionResult {
  // New format: has subQuestions array
  if (Array.isArray(parsed.subQuestions)) {
    return {
      stem: typeof parsed.stem === 'string' && parsed.stem.trim() ? parsed.stem : undefined,
      subQuestions: (parsed.subQuestions as unknown[]).map((sq) => {
        const sqObj = sq as Record<string, unknown>
        return {
          prompt: String(sqObj.prompt || ''),
          type: ['free_response', 'mcq', 'true_false'].includes(sqObj.type as string)
            ? (sqObj.type as 'free_response' | 'mcq' | 'true_false')
            : 'free_response',
          options: Array.isArray(sqObj.options) ? sqObj.options.map((opt) => String(opt)) : [],
          correctAnswer: typeof sqObj.correctAnswer === 'number' ? sqObj.correctAnswer : null,
          acceptedAnswers: Array.isArray(sqObj.acceptedAnswers)
            ? sqObj.acceptedAnswers.map((a) => String(a))
            : undefined,
        }
      }),
      diagramDescription,
      diagramPosition,
    }
  }

  // Old format: has question field — wrap into multi-part format
  const options = Array.isArray(parsed.options) ? parsed.options.map((opt) => String(opt)) : []
  let type: 'free_response' | 'mcq' | 'true_false' = 'free_response'
  if (
    options.length === 2 &&
    options.some((o) => o.toLowerCase() === 'true') &&
    options.some((o) => o.toLowerCase() === 'false')
  ) {
    type = 'true_false'
  } else if (options.length > 0) {
    type = 'mcq'
  }

  return {
    stem: undefined,
    subQuestions: [
      {
        prompt: String(parsed.question || ''),
        type,
        options,
        correctAnswer: typeof parsed.correctAnswer === 'number' ? parsed.correctAnswer : null,
        acceptedAnswers: parsed.explanation ? [String(parsed.explanation)] : undefined,
      },
    ],
    diagramDescription,
    diagramPosition,
  }
}

/**
 * Multi-part exercise extraction result (NEW)
 */
export interface MultiPartExtractionResult {
  stem?: string
  subQuestions: Array<{
    prompt: string
    type?: 'free_response' | 'mcq' | 'true_false'
    options?: string[]
    correctAnswer?: number | null
    acceptedAnswers?: string[]
  }>
  diagramDescription?: string
  diagramPosition?: 'before_question' | 'after_question'
}

/**
 * V3 response type with multi-part exercise extraction support
 */
export interface ImageToExerciseV3Response {
  success: boolean
  data?: MultiPartExtractionResult
  error?: string
  metadata: {
    model: string
    processingTimeMs: number
    imageSizeBytes: number
  }
}

/**
 * Extract structured exercise data from an uploaded image WITH diagram detection
 * Returns extended response including diagram description and position
 *
 * Uses V3_EXERCISE_WITH_DIAGRAMS_PROMPT to also extract diagram information.
 */
export async function extractFromImageV3(
  input: ImageToExerciseInput,
  payload: Payload,
): Promise<ImageToExerciseV3Response> {
  const startTime = Date.now()
  let modelConfig: AIModel | null = null

  try {
    // Dynamic import to prevent Node.js-only modules from being bundled into client code
    const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
    const adapter = await createGenkitUnifiedAdapter(payload)
    modelConfig = resolveModelConfig('IMAGE_TO_EXERCISE')

    // Prepare multimodal input with V3 prompt that includes diagram extraction
    const prompt = `${V3_EXERCISE_WITH_DIAGRAMS_PROMPT}\n\nExtract the exercise from this image. Return JSON with: stem (shared context), subQuestions[] (each with prompt, type, options if MCQ, correctAnswer if MCQ, acceptedAnswers if free response), diagramDescription (optional), diagramPosition (optional).`

    // For PDFs, pass directly to Gemini (it handles PDF natively)
    // For images, optimize before sending to reduce API latency/costs
    let attachmentData: string
    let sizeBytes: number

    if (input.mimeType === 'application/pdf') {
      attachmentData = input.imageBuffer.toString('base64')
      sizeBytes = input.imageBuffer.length
    } else {
      const optimizedImage = await optimizeImageForAI(input.imageBuffer)
      attachmentData = optimizedImage.buffer.toString('base64')
      sizeBytes = optimizedImage.sizeBytes
    }

    // Generate content using Genkit adapter
    const result = await adapter.generateMultimodalCompletion(
      {
        prompt,
        model: modelConfig,
        attachments: [
          {
            data: attachmentData,
            mimeType: input.mimeType,
          },
        ],
      },
      payload,
    )

    const responseText = result.text.trim()

    // Clean JSON response (remove markdown code blocks if present)
    const cleanedText = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim()

    // Parse JSON
    const parsed = JSON.parse(cleanedText)

    // Check for errors from AI
    if (parsed.error) {
      return {
        success: false,
        error: parsed.error,
        metadata: {
          model: modelConfig.name,
          processingTimeMs: Date.now() - startTime,
          imageSizeBytes: sizeBytes,
        },
      }
    }

    // Tolerant parsing: handle diagramDescription and diagramPosition
    let diagramDescription: string | undefined = undefined
    let diagramPosition: 'before_question' | 'after_question' | undefined = undefined

    // If diagramDescription is present and is a non-empty string, use it
    if (typeof parsed.diagramDescription === 'string' && parsed.diagramDescription.trim()) {
      diagramDescription = parsed.diagramDescription.trim()
    }

    // Validate diagramPosition - only accept valid values
    if (
      parsed.diagramPosition === 'before_question' ||
      parsed.diagramPosition === 'after_question'
    ) {
      diagramPosition = parsed.diagramPosition
    } else if (diagramDescription) {
      // Default to before_question if diagram exists but position is invalid/missing
      diagramPosition = 'before_question'
    }

    // Normalize LLM response to multi-part format
    const normalized = normalizeToMultiPart(parsed, diagramDescription, diagramPosition)

    // Return successful result with normalized multi-part format
    return {
      success: true,
      data: normalized,
      metadata: {
        model: modelConfig.name,
        processingTimeMs: Date.now() - startTime,
        imageSizeBytes: sizeBytes,
      },
    }
  } catch (error) {
    // Handle any errors during processing
    // Use default model name for error reporting if modelConfig is not available
    const errorModelName = modelConfig?.name ?? getDefaultModelName()
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      metadata: {
        model: errorModelName,
        processingTimeMs: Date.now() - startTime,
        imageSizeBytes: 0,
      },
    }
  }
}
