/**
 * Data extraction service using Gemini AI
 * Extracts structured data from images (questions, options, answers)
 *
 * Future: Can be extended for exercise chat, editing assistance, etc.
 */
import { getGeminiClient } from '@/server/llm/gemini.client'
import type { Payload } from 'payload'
import { AI_MODELS } from '../models'
import { SIMPLE_TEXT_QUESTION_PROMPT } from '../prompts/simple-text-question'
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
 */
export async function extractFromImage(
  input: ImageToExerciseInput,
  payload: Payload,
): Promise<ImageToExerciseResponse> {
  const startTime = Date.now()

  try {
    // Optimize image
    const optimizedImage = await optimizeImageForAI(input.imageBuffer)

    // Get AI client and model (requires Payload for config access)
    const client = await getGeminiClient(payload)
    const modelConfig = AI_MODELS.IMAGE_TO_EXERCISE
    const model = client.getGenerativeModel({
      model: modelConfig.name,
      systemInstruction: SIMPLE_TEXT_QUESTION_PROMPT,
    })

    // Prepare parts for the API (image only, no additional text)
    // Using inline data format for Gemini API
    const parts: Array<{ inlineData: { data: string; mimeType: string } }> = [
      {
        inlineData: {
          data: optimizedImage.buffer.toString('base64'),
          mimeType: input.mimeType,
        },
      },
    ]

    // Generate content
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: modelConfig.temperature,
        maxOutputTokens: modelConfig.maxOutputTokens,
      },
    })

    const responseText = result.response.text().trim()

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
          imageSizeBytes: optimizedImage.sizeBytes,
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
        imageSizeBytes: optimizedImage.sizeBytes,
      },
    }
  } catch (error) {
    // Handle any errors during processing
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      metadata: {
        model: AI_MODELS.IMAGE_TO_EXERCISE.name,
        processingTimeMs: Date.now() - startTime,
        imageSizeBytes: 0,
      },
    }
  }
}
