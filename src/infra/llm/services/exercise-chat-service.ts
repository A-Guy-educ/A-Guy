/**
 * AI Chat Service for Exercise Help
 * Orchestrates chat with Gemini provider
 */
import { logger } from '@/infra/utils/logger'
import type { Payload } from 'payload'
import type { ComposedPrompt } from '../context-policy'
import { AI_MODELS } from '../models'
import {
  generateChatCompletion,
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
