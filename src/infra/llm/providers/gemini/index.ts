/**
 * Gemini Provider - Public Exports
 *
 * Usage:
 * ```ts
 * import { generateChatCompletion, generateChatCompletionWithTools, isGeminiApiKeyConfigured } from '@/lib/ai/providers/gemini'
 * ```
 */
export {
  GeminiError,
  GeminiErrorCode,
  generateChatCompletion,
  generateMultimodalCompletion,
  isGeminiApiKeyConfigured,
  type AIModel,
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
