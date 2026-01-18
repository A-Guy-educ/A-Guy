/**
 * Gemini Message Mapper
 * Converts between internal ChatMessage format and Gemini SDK format
 *
 * @internal This module is used by gemini.provider.ts only
 */
import type { GeminiHistoryItem, GeminiRole } from './gemini.types'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Convert internal role to Gemini format
 * - 'user' → 'user'
 * - 'assistant' → 'model'
 * - 'system' is handled separately (see mapMessagesToGeminiHistory)
 */
export function toGeminiRole(role: 'user' | 'assistant'): GeminiRole {
  return role === 'assistant' ? 'model' : 'user'
}

/**
 * Convert Gemini role to internal format
 */
export function fromGeminiRole(role: GeminiRole): 'user' | 'assistant' {
  return role === 'model' ? 'assistant' : 'user'
}

/**
 * Map internal messages to Gemini history format
 *
 * Key behaviors:
 * 1. System message → user message + model acknowledgment pair
 * 2. User/assistant messages → direct mapping
 * 3. Returns the current user message separately (for sendMessage)
 *
 * @param messages - Internal message array (may include system)
 * @param currentMessage - The current user message text
 * @param acknowledgment - Text for model to acknowledge system prompt
 * @returns Object with history array and extracted current message
 */
export function mapMessagesToGeminiHistory(
  messages: ChatMessage[],
  currentMessage: string,
  acknowledgment: string,
): {
  history: GeminiHistoryItem[]
  currentMessage: string
} {
  const history: GeminiHistoryItem[] = []
  let lastUserMessageContent: string | null = null

  for (const msg of messages) {
    if (msg.role === 'system') {
      // System message becomes user + model acknowledgment pair
      // (Gemini doesn't have native system messages)
      history.push({
        role: 'user',
        parts: [{ text: msg.content }],
      })
      history.push({
        role: 'model',
        parts: [{ text: acknowledgment }],
      })
    } else if (msg.role === 'user') {
      lastUserMessageContent = msg.content
      history.push({
        role: 'user',
        parts: [{ text: msg.content }],
      })
    } else if (msg.role === 'assistant') {
      history.push({
        role: 'model',
        parts: [{ text: msg.content }],
      })
    }
  }

  // CRITICAL: The current user message may already be in the history
  // (persisted before AI call). Remove it to avoid duplication.
  let finalCurrentMessage = currentMessage
  if (lastUserMessageContent === currentMessage && history.length > 0) {
    const lastEntry = history[history.length - 1]
    if (lastEntry.role === 'user') {
      history.pop()
      finalCurrentMessage = lastUserMessageContent
    }
  }

  return {
    history,
    currentMessage: finalCurrentMessage,
  }
}

/**
 * Extract text from Gemini response
 */
export function extractResponseText(response: { text: () => string }): string {
  return response.text()
}
