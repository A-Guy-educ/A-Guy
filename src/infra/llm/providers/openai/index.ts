/**
 * OpenAI-Compatible Provider - Public Exports
 *
 * Usage:
 * ```ts
 * import { generateChatCompletion, generateChatCompletionWithTools, isOpenAIApiKeyConfigured } from '@/lib/ai/providers/openai'
 * ```
 */
export {
  generateChatCompletion,
  generateMultimodalCompletion,
  isOpenAIApiKeyConfigured,
  OpenAIError,
  OpenAIErrorCode,
  type AIModel,
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
