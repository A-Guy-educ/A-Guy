/**
 * AI Chat Service for Exercise Help
 * Orchestrates chat with Gemini provider
 */
import { logger } from '@/utilities/logger'
import type { ComposedPrompt } from '../context-policy'
import { AI_MODELS } from '../models'
import {
  generateChatCompletion,
  type ChatMessage as ProviderChatMessage,
} from '../providers/gemini'
import type { FunctionCall, Tool, ToolConfig } from '@google/generative-ai'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ExerciseChatInput {
  message: string
  acknowledgment: string
  conversationHistory?: ChatMessage[]
  composedPrompt?: ComposedPrompt
  tools?: Tool[]
  toolConfig?: ToolConfig
  extraMessages?: ProviderChatMessage[]
}

export interface ExerciseChatResult {
  success: boolean
  message?: string
  toolCalls?: FunctionCall[]
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

    if (input.extraMessages && input.extraMessages.length > 0) {
      messages.push(...input.extraMessages)
    }

    const result = await generateChatCompletion({
      system: systemPrompt,
      messages,
      model: AI_MODELS.EXERCISE_CHAT,
      acknowledgment: input.acknowledgment,
      tools: input.tools,
      toolConfig: input.toolConfig,
    })

    return {
      success: true,
      message: result.text,
      toolCalls: result.toolCalls,
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
