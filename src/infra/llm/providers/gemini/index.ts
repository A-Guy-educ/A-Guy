/**
 * Gemini Provider - Public Exports
 *
 * Usage:
 * ```ts
 * import { generateChatCompletion, generateChatCompletionWithTools, isGeminiApiKeyConfigured } from '@/lib/ai/providers/gemini'
 * ```
 */

// Re-export types from centralized models.ts (consolidated)
export type { AIModel, AIModelKey } from '@/infra/llm/models'

export {
  GeminiError,
  GeminiErrorCode,
  generateChatCompletion,
  generateMultimodalCompletion,
  isGeminiApiKeyConfigured,
  type ChatMessage,
  type GenerateChatInput,
  type GenerateChatOutput,
  type GenerateMultimodalInput,
} from './gemini.provider'

// Tool calling extensions
export {
  generateChatCompletionWithTools,
  type ToolCallingInput,
  type ToolCallingOutput,
} from './gemini-tool-calling'
