/**
 * Gemini Provider - Public Exports
 *
 * Usage:
 * ```ts
 * import { generateChatCompletion, isGeminiApiKeyConfigured } from '@/lib/ai/providers/gemini'
 * ```
 */
export {
  GeminiError,
  GeminiErrorCode,
  generateChatCompletion,
  isGeminiApiKeyConfigured,
  type AIModel,
  type ChatMessage,
  type GenerateChatInput,
  type GenerateChatOutput,
} from './gemini.provider'
