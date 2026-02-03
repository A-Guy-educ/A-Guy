/**
 * OpenAI-Compatible Provider - Public Exports
 *
 * Usage:
 * ```ts
 * import { generateChatCompletion, generateChatCompletionWithTools, isOpenAIApiKeyConfigured } from '@/lib/ai/providers/openai'
 * ```
 */

// Re-export types from centralized models.ts (consolidated)
export type { AIModel, AIModelKey } from '@/infra/llm/models'

export {
  generateChatCompletion,
  generateMultimodalCompletion,
  isOpenAIApiKeyConfigured,
  OpenAIError,
  OpenAIErrorCode,
  type GenerateChatInput,
  type GenerateChatOutput,
  type GenerateMultimodalInput,
} from './openai.provider'

// Re-export types from mapper
export type { ChatMessage } from './openai.mapper'

// Tool calling extensions
export {
  generateChatCompletionWithTools,
  type ToolCallingInput,
  type ToolCallingOutput,
} from './openai-tool-calling'

// Tool utilities
export {
  extractOpenAIToolCalls,
  formatToolResultForOpenAI,
  hasOpenAIToolCalls,
  mcpToolsToOpenAIFunctionDeclarations,
  type OpenAIFunctionDeclaration,
  type ParsedToolCall,
} from './openai-tools'

// Multimodal mapper
export { isOpenAIMediaTypeSupported, mapMultimodalToOpenAI } from './multimodal-mapper'
