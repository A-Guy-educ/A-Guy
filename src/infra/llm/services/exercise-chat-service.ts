/**
 * AI Chat Service for Exercise Help
 * Orchestrates chat with AI providers using factory pattern (text and multimodal)
 *
 * Uses factory pattern for provider-agnostic model selection.
 * Supports Gemini and OpenAI-compatible providers via getLLMProvider.
 */
import type { Payload } from 'payload'

import { logger } from '@/infra/utils/logger'

import type { ComposedPrompt } from '../context-policy'
import type { AIModel } from '../models'
import type { MediaPartWithPath } from '../multimodal/types'
import { detectBestProvider, getLLMProvider, getProviderModelConfig } from '../providers/factory'
import type { ChatMessage as ProviderChatMessage } from '../providers/gemini'
import { mapMultimodalToGemini } from '../providers/gemini/multimodal-mapper'

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
  /** Request context for auth headers (serverless compatibility) */
  req?: { headers: { authorization?: string; cookie?: string } }
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
    // Detect provider and get model config
    const providerType = await detectBestProvider(payload)
    const provider = await getLLMProvider(payload, { type: providerType })
    const modelConfig = getProviderModelConfig(providerType, 'EXERCISE_CHAT')

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
    // Note: Gemini-specific multimodal handling for now
    if (input.mediaPartsWithPath && input.mediaPartsWithPath.length > 0) {
      return await sendMultimodalToGemini(
        systemPrompt,
        input.message,
        input.mediaPartsWithPath,
        modelConfig,
        payload,
        input.req,
      )
    }

    // Text-only path using unified provider interface
    const result = await provider.generateChatCompletion(
      {
        system: systemPrompt,
        messages,
        model: modelConfig,
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
  req?: { headers: { authorization?: string; cookie?: string } },
): Promise<ExerciseChatResult> {
  // Convert media to Gemini parts using existing mapper
  const { currentMessage: multimodalParts } = await mapMultimodalToGemini(
    mediaPartsWithPath,
    payload,
    req,
  )

  logger.info(
    {
      mediaInputCount: mediaPartsWithPath.length,
      multimodalPartsCount: multimodalParts.length,
      hasInlineData: multimodalParts.some((p) => 'inlineData' in p),
    },
    '[ExerciseChat] Multimodal parts prepared for Gemini',
  )

  // Build content: user message text + media parts
  const fullContents = [{ text: userMessage }, ...multimodalParts]

  logger.info(
    {
      totalParts: fullContents.length,
      textParts: fullContents.filter((p) => 'text' in p).length,
      inlineDataParts: fullContents.filter((p) => 'inlineData' in p).length,
    },
    '[ExerciseChat] Sending to Gemini',
  )

  try {
    // Use unified provider interface with direct Gemini access for multimodal
    const provider = await getLLMProvider(payload, { type: LLMProviderType.GEMINI })
    const result = await provider.generateMultimodalCompletion(
      {
        prompt: `${systemPrompt}\n\n${userMessage}`,
        model,
        attachments: multimodalParts
          .filter((p) => 'inlineData' in p)
          .map((p) => ({
            data: (p as { inlineData: { data: string } }).inlineData.data,
            mimeType: (p as { inlineData: { mimeType: string } }).inlineData.mimeType,
          })),
      },
      payload,
    )

    return {
      success: true,
      message: result.text,
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

// Re-export LLMProviderType for use in this file
import { LLMProviderType } from '../providers/factory'
