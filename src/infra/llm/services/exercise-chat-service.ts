/**
 * AI Chat Service for Exercise Help
 * Orchestrates chat with Gemini provider (text and multimodal)
 */
import type { Part } from '@google/generative-ai'
import type { Payload } from 'payload'

import { logger } from '@/infra/utils/logger'
import { getGeminiClient } from '@/server/llm/gemini.client'

import type { ComposedPrompt } from '../context-policy'
import { AI_MODELS } from '../models'
import type { MediaPartWithPath } from '../multimodal/types'
import { mapMultimodalToGemini } from '../providers/gemini/multimodal-mapper'
import {
  generateChatCompletion,
  type AIModel,
  type ChatMessage as ProviderChatMessage,
} from '../providers/gemini'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ExerciseChatInput {
  message: string
  acknowledgment: string
  conversationHistory?: ChatMessage[]
  composedPrompt?: ComposedPrompt
  /** Media attachments for multimodal messages */
  mediaPartsWithPath?: MediaPartWithPath[]
}

export interface ExerciseChatResult {
  success: boolean
  message?: string
  error?: string
}

// Fallback for legacy callers (deprecated)
const LEGACY_FALLBACK = 'You are a helpful assistant.'

/**
 * @deprecated Use resolveAgentSystemPrompt from prompt-resolver.server instead.
 */
export function getSystemPrompt(): string {
  logger.warn('[DEPRECATED] getSystemPrompt() called - migrate to prompt resolver')
  return LEGACY_FALLBACK
}

export async function chatWithExerciseHelper(
  input: ExerciseChatInput,
  payload: Payload,
): Promise<ExerciseChatResult> {
  try {
    // Build messages from composedPrompt or legacy format
    let systemPrompt: string
    let messages: ProviderChatMessage[]

    if (input.composedPrompt) {
      // Extract system from composed prompt
      const systemMsg = input.composedPrompt.messages.find((m) => m.role === 'system')
      systemPrompt = systemMsg?.content ?? LEGACY_FALLBACK

      // Convert to provider format
      messages = input.composedPrompt.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
    } else {
      // Legacy path
      systemPrompt = getSystemPrompt()
      messages =
        input.conversationHistory?.map((m) => ({
          role: m.role,
          content: m.content,
        })) ?? []
      // Add current message
      messages.push({ role: 'user', content: input.message })
    }

    // Handle multimodal content if media is attached
    if (input.mediaPartsWithPath && input.mediaPartsWithPath.length > 0) {
      return await sendMultimodalToGemini(
        systemPrompt,
        input.message,
        input.mediaPartsWithPath,
        AI_MODELS.EXERCISE_CHAT,
        payload,
      )
    }

    // Text-only path
    const result = await generateChatCompletion(
      {
        system: systemPrompt,
        messages,
        model: AI_MODELS.EXERCISE_CHAT,
        acknowledgment: input.acknowledgment,
      },
      payload,
    )

    return {
      success: true,
      message: result.text,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error({ err: error }, '[ExerciseChat] Chat failed')

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Send multimodal content (text + media) to Gemini
 * Uses native Gemini multimodal API with inline base64 data
 */
async function sendMultimodalToGemini(
  systemPrompt: string,
  userMessage: string,
  mediaPartsWithPath: MediaPartWithPath[],
  model: AIModel,
  payload: Payload,
): Promise<ExerciseChatResult> {
  const client = await getGeminiClient(payload)
  const geminiModel = client.getGenerativeModel({
    model: model.name,
    generationConfig: {
      temperature: model.temperature,
      maxOutputTokens: model.maxOutputTokens,
    },
  })

  // Convert media to Gemini parts
  const { currentMessage: multimodalParts } = await mapMultimodalToGemini(mediaPartsWithPath)

  logger.info(
    {
      mediaInputCount: mediaPartsWithPath.length,
      multimodalPartsCount: multimodalParts.length,
      hasInlineData: multimodalParts.some((p) => 'inlineData' in p),
    },
    '[ExerciseChat] Multimodal parts prepared for Gemini',
  )

  // Build content: system prompt + user message text + media parts
  const fullContents: Part[] = [
    { text: `System: ${systemPrompt}\n\nUser: ${userMessage}` },
    ...multimodalParts,
  ]

  logger.info(
    {
      totalParts: fullContents.length,
      textParts: fullContents.filter((p) => 'text' in p).length,
      inlineDataParts: fullContents.filter((p) => 'inlineData' in p).length,
    },
    '[ExerciseChat] Sending to Gemini',
  )

  try {
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: fullContents }],
    })

    const response = result.response
    const text = response.text()

    return {
      success: true,
      message: text,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error({ err: error }, '[ExerciseChat] Multimodal Gemini call failed')
    return {
      success: false,
      error: errorMessage,
    }
  }
}
