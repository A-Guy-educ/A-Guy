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
  generateMultimodalCompletion,
  isGeminiApiKeyConfigured,
  type AIModel,
  type ChatMessage,
  type GenerateChatInput,
  type GenerateChatOutput,
  type GenerateMultimodalInput
} from './gemini.provider';

