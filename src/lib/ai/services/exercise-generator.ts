/**
 * Exercise generation service using Gemini AI
 * Handles image-to-exercise conversion with simplified output
 *
 * Future: Can be extended for exercise chat, editing assistance, etc.
 */
import { getGeminiClient } from '../gemini-ai-provider.server'
import { AI_MODELS } from '../models'
import { optimizeImageForAI } from './image-optimizer-service'
import { IMAGE_TO_EXERCISE_PROMPT } from '../prompts/simple-text-question'

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
 * Generate an exercise from an uploaded image
 * Simplified version: Returns basic question/options/answer structure
 */
export async function generateExerciseFromImage(
  input: ImageToExerciseInput,
): Promise<ImageToExerciseResponse> {
  const startTime = Date.now()

  try {
    // Optimize image
    const optimizedImage = await optimizeImageForAI(input.imageBuffer)

    // Get AI client and model
    const client = getGeminiClient()
    const modelConfig = AI_MODELS.IMAGE_TO_EXERCISE
    const model = client.getGenerativeModel({
      model: modelConfig.name,
      systemInstruction: IMAGE_TO_EXERCISE_PROMPT,
    })

    // Prepare parts for the API (image only, no additional text)
    const parts: any[] = [
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
