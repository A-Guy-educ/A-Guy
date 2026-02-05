export const __genkit_exports__ = true
/**
 * Unified Adapter
 * Provides UnifiedLLMProvider interface backed by Genkit
 *
 * @fileType adapter
 * @domain ai
 * @pattern abstraction, genkit, provider-abstraction
 *
 * Maintains backward compatibility with existing UnifiedLLMProvider interface
 */
import type { AIModel, AIModelKey } from '@/infra/llm/models'
import type { UnifiedLLMProvider } from '@/infra/llm/providers/factory'
import { LLMErrorCode } from '@/infra/llm/providers/shared/errors'
import { withRetry } from '@/infra/llm/providers/shared/retry'
import type { Payload } from 'payload'
import { resolveGenkitConfig } from '../config-resolver'
import { getGenkitInstance } from '../genkit-instance'
import { getErrorAdapter } from './error-adapter'

/**
 * Chat completion input
 */
interface ChatCompletionInput {
  system: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  model: AIModel
  acknowledgment: string
  timeoutMs?: number
}

/**
 * Multimodal completion input
 */
interface MultimodalCompletionInput {
  prompt: string
  model: AIModel
  attachments: Array<{ data: string; mimeType: string }>
  timeoutMs?: number
}

/**
 * Tool calling input
 */
interface ToolCallingInput {
  system: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  model: AIModel
  acknowledgment: string
  tools: Array<{
    name: string
    description?: string
    inputSchema?: Record<string, unknown>
  }>
  toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>
  timeoutMs?: number
}

/**
 * Create a Genkit-backed UnifiedLLMProvider
 */
export async function createGenkitUnifiedAdapter(
  payload: Payload,
  tenantId?: string,
): Promise<UnifiedLLMProvider> {
  // Get provider type for error classification
  const { getProviderTypeFromEnv } = await import('@/infra/llm/providers/factory')
  const providerType = await getProviderTypeFromEnv(payload)
  const errorAdapter = getErrorAdapter(providerType)

  return {
    /**
     * Generate chat completion
     */
    generateChatCompletion: async (input: ChatCompletionInput, payloadInstance: Payload) => {
      const modelKey = getModelKeyFromModelName(input.model.name) || 'EXERCISE_CHAT'
      const config = await resolveGenkitConfig(modelKey, tenantId, payloadInstance)

      const ai = await getGenkitInstance(payloadInstance, tenantId)

      return withRetry(
        async () => {
          try {
            const prompt =
              input.system +
              '\n\n' +
              input.messages.map((m) => `${m.role}: ${m.content}`).join('\n')

            const result = await ai.generate({
              model: config.model,
              prompt,
            })

            return {
              text: result.text,
              raw: result,
            }
          } catch (error) {
            const llmError = errorAdapter.wrapError(
              error instanceof Error ? error : new Error(String(error)),
            )
            throw llmError
          }
        },
        {
          maxRetries: 3,
          isRetryable: errorAdapter.isRetryable,
          wrapError: (error: Error) => errorAdapter.wrapError(error, LLMErrorCode.API_ERROR),
          logPrefix: '[GenkitUnifiedAdapter]',
        },
      )
    },

    /**
     * Generate multimodal completion
     */
    generateMultimodalCompletion: async (
      input: MultimodalCompletionInput,
      payloadInstance: Payload,
    ) => {
      const modelKey = getModelKeyFromModelName(input.model.name) || 'IMAGE_TO_EXERCISE'
      const config = await resolveGenkitConfig(modelKey, tenantId, payloadInstance)

      const ai = await getGenkitInstance(payloadInstance, tenantId)

      return withRetry(
        async () => {
          try {
            // Build multimodal prompt with media
            const mediaContents = input.attachments.map((attachment) => ({
              media: {
                url: `data:${attachment.mimeType};base64,${attachment.data}`,
              },
            }))

            const result = await ai.generate({
              model: config.model,
              prompt: [...mediaContents, { text: input.prompt }],
            })

            return {
              text: result.text,
              raw: result,
            }
          } catch (error) {
            const llmError = errorAdapter.wrapError(
              error instanceof Error ? error : new Error(String(error)),
            )
            throw llmError
          }
        },
        {
          maxRetries: 3,
          isRetryable: errorAdapter.isRetryable,
          wrapError: (error: Error) => errorAdapter.wrapError(error, LLMErrorCode.API_ERROR),
          logPrefix: '[GenkitUnifiedAdapter]',
        },
      )
    },

    /**
     * Generate chat completion with tools
     */
    generateChatCompletionWithTools: async (input: ToolCallingInput, payloadInstance: Payload) => {
      const modelKey = getModelKeyFromModelName(input.model.name) || 'EXERCISE_CHAT'
      const config = await resolveGenkitConfig(modelKey, tenantId, payloadInstance)

      const ai = await getGenkitInstance(payloadInstance, tenantId)

      return withRetry(
        async () => {
          try {
            const prompt =
              input.system +
              '\n\n' +
              input.messages.map((m) => `${m.role}: ${m.content}`).join('\n')

            const result = await ai.generate({
              model: config.model,
              prompt,
            })

            return {
              text: result.text,
              raw: result,
              toolCalls: [],
            }
          } catch (error) {
            const llmError = errorAdapter.wrapError(
              error instanceof Error ? error : new Error(String(error)),
            )
            throw llmError
          }
        },
        {
          maxRetries: 3,
          isRetryable: errorAdapter.isRetryable,
          wrapError: (error: Error) => errorAdapter.wrapError(error, LLMErrorCode.API_ERROR),
          logPrefix: '[GenkitUnifiedAdapter]',
        },
      )
    },

    /**
     * Check if provider is configured
     */
    isConfigured: async (payloadInstance: Payload) => {
      try {
        await getGenkitInstance(payloadInstance, tenantId)
        return true
      } catch {
        return false
      }
    },

    /**
     * Error codes for this provider
     */
    errorCodes: LLMErrorCode,
  }
}

/**
 * Map model name back to AIModelKey
 */
function getModelKeyFromModelName(modelName: string): AIModelKey | undefined {
  const name = modelName.toLowerCase()

  if (name.includes('image') || name.includes('vision')) {
    return 'IMAGE_TO_EXERCISE'
  }
  if (name.includes('pdf') || name.includes('document')) {
    return 'PDF_TO_EXERCISE'
  }
  if (name.includes('chat')) {
    return 'EXERCISE_CHAT'
  }

  return 'EXERCISE_CHAT'
}

/**
 * Quick check if Genkit is available for the provider
 */
export async function isGenkitConfigured(payload: Payload, tenantId?: string): Promise<boolean> {
  try {
    await getGenkitInstance(payload, tenantId)
    return true
  } catch {
    return false
  }
}
