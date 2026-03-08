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
import { getCircuitBreaker } from '@/infra/llm/providers/shared/circuit-breaker'
import { LLMErrorCode } from '@/infra/llm/providers/shared/errors'
import { withRetry } from '@/infra/llm/providers/shared/retry'
import { tool } from 'genkit'
import type { Payload } from 'payload'
import { resolveGenkitConfig } from '../config-resolver'
import { getGenkitInstance } from '../genkit-instance'
import { getErrorAdapter } from './error-adapter'

/**
 * Extract key parameter names from MCP tool inputSchema for enhanced descriptions.
 * The MCP plugin generates complex schemas, but we just need the top-level field names.
 */
function extractKeyParams(inputSchema: Record<string, unknown> | undefined): string[] {
  if (!inputSchema || typeof inputSchema !== 'object') return []
  const params = inputSchema.properties
  if (!params || typeof params !== 'object') return []
  return Object.keys(params).slice(0, 10)
}

/**
 * Build enhanced tool description with key parameters for better LLM guidance.
 */
function buildToolDescription(
  baseDescription: string,
  inputSchema: Record<string, unknown> | undefined,
): string {
  const keyParams = extractKeyParams(inputSchema)
  if (keyParams.length === 0) return baseDescription

  const requiredParams = new Set<string>()
  if (inputSchema && Array.isArray((inputSchema as Record<string, unknown>).required)) {
    for (const req of (inputSchema as Record<string, unknown>).required as string[]) {
      requiredParams.add(req)
    }
  }

  const paramList = keyParams.map((p) => (requiredParams.has(p) ? `${p}*` : p)).join(', ')

  return `${baseDescription} Parameters: ${paramList}`
}

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
  const circuitBreaker = getCircuitBreaker(`genkit-${providerType}`)

  return {
    /**
     * Generate chat completion
     */
    generateChatCompletion: async (input: ChatCompletionInput, payloadInstance: Payload) => {
      const modelKey = getModelKeyFromModelName(input.model.name) || 'EXERCISE_CHAT'
      const config = await resolveGenkitConfig(modelKey, tenantId, payloadInstance)

      const ai = await getGenkitInstance(payloadInstance, tenantId)

      return circuitBreaker.execute(() => withRetry(
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
      ))
    },

    /**
     * Generate streaming chat completion
     * Returns a stream of chunks and a promise that resolves when streaming is complete
     */
    generateStreamingChatCompletion: async (
      input: ChatCompletionInput,
      payloadInstance: Payload,
    ) => {
      const modelKey = getModelKeyFromModelName(input.model.name) || 'EXERCISE_CHAT'
      const config = await resolveGenkitConfig(modelKey, tenantId, payloadInstance)

      const ai = await getGenkitInstance(payloadInstance, tenantId)

      // Build prompt
      const prompt =
        input.system + '\n\n' + input.messages.map((m) => `${m.role}: ${m.content}`).join('\n')

      // Get streaming response - Genkit returns { stream: AsyncIterable, response: Promise }
      // Circuit breaker wraps stream initialization to fail fast if provider is down
      const result = await circuitBreaker.execute(() =>
        ai.generateStream({
          model: config.model,
          prompt,
        }),
      )

      // result.stream is already an AsyncIterable<GenerateResponseChunk>
      const genkitStream = result.stream

      // Wrap to return { text: string } format
      const stream: AsyncIterable<{ text: string }> = {
        [Symbol.asyncIterator]: () => {
          const iterator = genkitStream[Symbol.asyncIterator]()
          return {
            async next() {
              const chunkResult = await iterator.next()
              if (chunkResult.done) {
                return { done: true, value: undefined }
              }
              // Genkit chunks have .text property
              return {
                done: false,
                value: { text: chunkResult.value?.text || '' },
              }
            },
          }
        },
      }

      // Create response promise that handles errors
      const response = (async () => {
        try {
          const finalResult = await result.response
          return { text: finalResult?.text || '' }
        } catch (error) {
          const llmError = errorAdapter.wrapError(
            error instanceof Error ? error : new Error(String(error)),
          )
          throw llmError
        }
      })()

      return { stream, response }
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

      return circuitBreaker.execute(() => withRetry(
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
      ))
    },

    /**
     * Generate chat completion with tools
     */
    generateChatCompletionWithTools: async (input: ToolCallingInput, payloadInstance: Payload) => {
      const modelKey = getModelKeyFromModelName(input.model.name) || 'EXERCISE_CHAT'
      const config = await resolveGenkitConfig(modelKey, tenantId, payloadInstance)

      const ai = await getGenkitInstance(payloadInstance, tenantId)

      return circuitBreaker.execute(() => withRetry(
        async () => {
          try {
            const genkitTools = input.tools.map((t) =>
              tool(
                {
                  name: t.name,
                  description: buildToolDescription(t.description || '', t.inputSchema),
                },
                async (args) => {
                  const result = await input.toolExecutor(t.name, args as Record<string, unknown>)
                  return result
                },
              ),
            )

            // Build messages ensuring first non-system message is 'user'
            const systemMessage = { role: 'system' as const, content: [{ text: input.system }] }
            type MappedMessage = {
              role: 'system' | 'user' | 'model'
              content: Array<{ text: string }>
            }
            const userAssistantMessages: MappedMessage[] = input.messages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : m.role === 'system' ? 'system' : 'user',
              content: [{ text: m.content }],
            }))

            // Ensure first non-system message is 'user'

            let messages: MappedMessage[] = []
            if (userAssistantMessages.length > 0 && userAssistantMessages[0].role !== 'user') {
              messages = [
                systemMessage,
                { role: 'user' as const, content: [{ text: 'Please continue.' }] },
                ...userAssistantMessages,
              ]
            } else {
              messages = [systemMessage, ...userAssistantMessages]
            }

            const result = await ai.generate({
              model: config.model,
              messages,
              tools: genkitTools as never,
              toolChoice: 'auto',
              maxTurns: 5,
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
      ))
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
