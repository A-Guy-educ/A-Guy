/**
 * AI Chat Service for Exercise Help
 * Provides conversational assistance using Gemini API
 */
import { getGeminiClient } from '../gemini-ai-provider.server'
import { AI_MODELS } from '../models'
import { logger } from '@/utilities/logger/logger'
import { ChatMessageRole } from '../chat-message-role'
import promptContent from '../prompts/exercise-chat-agent-prompt.md'

export interface ChatMessage {
  role: ChatMessageRole
  content: string
}

export interface ExerciseChatInput {
  message: string
  acknowledgment: string
  conversationHistory?: ChatMessage[]
}

export interface ExerciseChatResult {
  success: boolean
  message?: string
  error?: string
}

function getSystemPrompt(): string {
  // Extract content, remove markdown headers
  return promptContent
    .replace(/^#.*$/gm, '')
    .replace(/^##.*$/gm, '')
    .trim()
}

export async function chatWithExerciseHelper(
  input: ExerciseChatInput,
): Promise<ExerciseChatResult> {
  try {
    const systemPrompt = getSystemPrompt()
    const client = getGeminiClient()
    const modelConfig = AI_MODELS.EXERCISE_CHAT
    const model = client.getGenerativeModel({
      model: modelConfig.name,
      generationConfig: {
        temperature: modelConfig.temperature,
        maxOutputTokens: modelConfig.maxOutputTokens,
      },
    })

    // Build conversation history for Gemini
    // Start with system prompt exchange
    const history: any[] = [
      {
        role: ChatMessageRole.User,
        parts: [{ text: systemPrompt }],
      },
      {
        role: ChatMessageRole.Model,
        parts: [{ text: input.acknowledgment }],
      },
    ]

    // Add conversation history if provided
    if (input.conversationHistory && input.conversationHistory.length > 0) {
      const historyMessages = input.conversationHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      }))
      history.push(...historyMessages)
    }

    // Start chat with full history
    const chat = model.startChat({
      history,
    })

    const result = await chat.sendMessage(input.message)
    const responseText = result.response.text()

    return {
      success: true,
      message: responseText,
    }
  } catch (error) {
    logger.error({ err: error }, 'Exercise chat error')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process chat message',
    }
  }
}
