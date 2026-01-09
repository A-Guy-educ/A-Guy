/**
 * AI Chat Service for Exercise Help
 * Provides conversational assistance using Gemini API
 */
import { logger } from '@/utilities/logger'
import { ChatRole, toGeminiRole } from '../chat-message-role'
import type { ComposedPrompt } from '../context-policy'
import { getGeminiClient } from '../gemini-ai-provider.server'
import { AI_MODELS } from '../models'
import promptContent from '../prompts/exercise-chat-agent-prompt.md'

export interface ChatMessage {
  role: ChatRole
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

export function getSystemPrompt(): string {
  // Extract content, remove markdown headers
  return promptContent
    .replace(/^#.*$/gm, '')
    .replace(/^##.*$/gm, '')
    .trim()
}

const MODEL_TIMEOUT_MS = 30_000 // 30 seconds
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000 // 1 second

export async function chatWithExerciseHelper(
  input: ExerciseChatInput,
): Promise<ExerciseChatResult> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = getGeminiClient()
      const modelConfig = AI_MODELS.EXERCISE_CHAT
      const model = client.getGenerativeModel({
        model: modelConfig.name,
        generationConfig: {
          temperature: modelConfig.temperature,
          maxOutputTokens: modelConfig.maxOutputTokens,
        },
      })

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Model call timed out after ${MODEL_TIMEOUT_MS}ms`))
        }, MODEL_TIMEOUT_MS)
      })

      // Use composed prompt if provided (Context Policy V1)
      if (input.composedPrompt) {
        type GeminiHistoryItem = {
          role: 'user' | 'model'
          parts: Array<{ text: string }>
        }
        const history: GeminiHistoryItem[] = []
        let lastUserMessageContent: string | null = null

        // Convert composed prompt to Gemini format
        // CRITICAL: Track the last user message to avoid duplication
        // CRITICAL: Use correct Gemini role mapping ('user' | 'model')
        for (const msg of input.composedPrompt.messages) {
          if (msg.role === 'system') {
            // System message becomes user + model acknowledgment
            history.push({
              role: 'user' as const, // Gemini expects 'user' | 'model'
              parts: [{ text: msg.content }],
            })
            history.push({
              role: 'model' as const, // Gemini's assistant role
              parts: [{ text: input.acknowledgment }],
            })
          } else if (msg.role === 'user') {
            lastUserMessageContent = msg.content
            history.push({
              role: 'user' as const,
              parts: [{ text: msg.content }],
            })
          } else if (msg.role === 'assistant') {
            history.push({
              role: 'model' as const, // Correct Gemini role
              parts: [{ text: msg.content }],
            })
          }
        }

        // CRITICAL: The current user message is already in the composed prompt
        // (because it was persisted first, then reloaded). We need to extract it
        // and send it separately to Gemini, not include it in history.
        let currentMessage = input.message

        if (lastUserMessageContent === input.message && history.length > 0) {
          const lastEntry = history[history.length - 1]
          if (lastEntry.role === 'user') {
            // Remove the current user message from history (it will be sent via sendMessage)
            history.pop()
            currentMessage = lastUserMessageContent
          }
        }

        // DEBUG: Log history size
        logger.debug(
          {
            historyLength: history.length,
            composedPromptMessages: input.composedPrompt.messages.length,
            currentMessage: currentMessage.substring(0, 50),
          },
          '[DEBUG] Gemini history prepared',
        )

        // Start chat with history (excluding current message)
        const chat = model.startChat({ history })
        // Send current message to get response with timeout
        const result = await Promise.race([chat.sendMessage(currentMessage), timeoutPromise])
        const responseText = result.response.text()

        return {
          success: true,
          message: responseText,
        }
      }

      // Fallback: Legacy mode (for backward compatibility)
      const systemPrompt = getSystemPrompt()
      type GeminiHistoryItem = {
        role: 'user' | 'model'
        parts: Array<{ text: string }>
      }
      const history: GeminiHistoryItem[] = [
        {
          role: 'user' as const,
          parts: [{ text: systemPrompt }],
        },
        {
          role: 'model' as const,
          parts: [{ text: input.acknowledgment }],
        },
      ]

      // Add conversation history if provided
      if (input.conversationHistory && input.conversationHistory.length > 0) {
        const historyMessages = input.conversationHistory.map((msg) => ({
          role: toGeminiRole(msg.role),
          parts: [{ text: msg.content }],
        }))
        history.push(...historyMessages)
      }

      // Start chat with full history
      const chat = model.startChat({
        history,
      })

      const result = await Promise.race([chat.sendMessage(input.message), timeoutPromise])
      const responseText = result.response.text()

      return {
        success: true,
        message: responseText,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on certain errors (validation, auth, etc.)
      if (
        lastError.message.includes('API key') ||
        lastError.message.includes('invalid') ||
        lastError.message.includes('validation')
      ) {
        logger.error({ err: lastError, attempt }, '[ExerciseChat] Non-retryable error')
        break
      }

      // Retry with exponential backoff
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
        logger.warn(
          { err: lastError, attempt, delay, retrying: true },
          '[ExerciseChat] Retrying after error',
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // All retries exhausted
  logger.error({ err: lastError }, '[ExerciseChat] All retries exhausted')
  return {
    success: false,
    error: lastError?.message || 'Failed to process chat message after retries',
  }
}
