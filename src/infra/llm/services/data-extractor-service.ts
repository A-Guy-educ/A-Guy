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
