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
import { withTimeout } from '@/infra/llm/providers/shared/timeout'
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
  model: AIModel & { modelKey?: AIModelKey }
  acknowledgment: string
  timeoutMs?: number
}

/**
 * Multimodal completion input
 */
interface MultimodalCompletionInput {
  prompt: string
  model: AIModel & { modelKey?: AIModelKey }
  attachments: Array<{ data: string; mimeType: string }>
  timeoutMs?: number
}

/**
 * Tool calling input
 */
interface ToolCallingInput {
  system: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  model: AIModel & { modelKey?: AIModelKey }
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
 * Build structured messages array for Genkit from input system prompt and messages.
 * Ensures conversation history is passed correctly with proper role mapping.
 *
 * @param system - The system prompt
 * @param messages - The conversation messages with roles (user/assistant/system)
 * @returns Structured messages array suitable for Genkit's messages parameter
 */
function buildGenkitMessages(
  system: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
): Array<{ role: 'system' | 'user' | 'model'; content: Array<{ text: string }> }> {
  const systemMessage = { role: 'system' as const, content: [{ text: system }] }
  type MappedMessage = {
    role: 'system' | 'user' | 'model'
    content: Array<{ text: string }>
  }
  const userAssistantMessages: MappedMessage[] = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : m.role === 'system' ? 'system' : 'user',
    content: [{ text: m.content }],
  }))

  // Ensure first non-system message is 'user' (Genkit requirement)
  let result: MappedMessage[] = []
  if (userAssistantMessages.length > 0 && userAssistantMessages[0].role !== 'user') {
    result = [
      systemMessage,
      { role: 'user' as const, content: [{ text: 'Please continue.' }] },
      ...userAssistantMessages,
    ]
  } else {
    result = [systemMessage, ...userAssistantMessages]
  }

  return result
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
      const modelKey = input.model.modelKey || 'EXERCISE_CHAT'
      const config = await resolveGenkitConfig(modelKey, tenantId, payloadInstance)

      const ai = await getGenkitInstance(payloadInstance, tenantId)

      return circuitBreaker.execute(() =>
        withRetry(
          async () => {
            try {
              // Build structured messages to preserve conversation history
              const messages = buildGenkitMessages(input.system, input.messages)

              const result = await ai.generate({
                model: config.model,
                messages,
                config: { temperature: config.temperature },
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
        ),
      )
    },

    /**
     * Generate streaming chat completion
     * Returns a stream of chunks and a promise that resolves when streaming is complete
     */
    generateStreamingChatCompletion: async (
      input: ChatCompletionInput,
      payloadInstance: Payload,
    ) => {
      const modelKey = input.model.modelKey || 'EXERCISE_CHAT'
      const config = await resolveGenkitConfig(modelKey, tenantId, payloadInstance)

      const ai = await getGenkitInstance(payloadInstance, tenantId)

      // Build structured messages to preserve conversation history
      const messages = buildGenkitMessages(input.system, input.messages)

      // Get streaming response with timeout protection
      // A hung stream could block a serverless function until execution time limit
      const streamTimeoutMs = input.timeoutMs ?? 30_000
      const result = await withTimeout(
        async () =>
          ai.generateStream({
            model: config.model,
            messages,
            config: { temperature: config.temperature },
          }),
        { timeoutMs: streamTimeoutMs, message: 'Stream initialization timed out' },
      )

      // result.stream is a Genkit Channel<GenerateResponseChunk> (AsyncIterable)
      const genkitStream = result.stream

      // Use ReadableStream.from() to bridge Genkit's AsyncIterable to a web ReadableStream.
      // Node.js 22 has a known incompatibility where iterating a ReadableStream-as-AsyncIterable
      // inside another ReadableStream start() callback causes:
      //   TypeError: controller[kState].transformAlgorithm is not a function
      // ReadableStream.from() is the correct, Node.js-native way to convert an AsyncIterable.
      // Node.js ReadableStream.from() bridges AsyncIterable → ReadableStream cleanly.
      // Cast via `as any` because TypeScript's DOM lib doesn't include ReadableStream.from().
      // Cast result to AsyncIterable via `as unknown as` because Node.js ReadableStream
      // implements AsyncIterable at runtime but TS DOM types don't reflect this.
      const stream = (
        ReadableStream as unknown as {
          from: (iterable: AsyncIterable<{ text: string }>) => ReadableStream<{ text: string }>
        }
      ).from(
        (async function* (): AsyncGenerator<{ text: string }> {
          for await (const chunk of genkitStream) {
            yield { text: chunk.text || '' }
          }
        })(),
      ) as unknown as AsyncIterable<{ text: string }>

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
      const modelKey = input.model.modelKey || 'IMAGE_TO_EXERCISE'
      const config = await resolveGenkitConfig(modelKey, tenantId, payloadInstance)

      // Prefer caller-provided config over resolved config
      const effectiveMaxOutputTokens = input.model.maxOutputTokens || config.maxOutputTokens
      const effectiveTemperature = input.model.temperature ?? config.temperature
      // Allow callers to override the resolved model name by passing a prefixed name
      const modelToUse = input.model.name.includes('/') ? input.model.name : config.model

      const ai = await getGenkitInstance(payloadInstance, tenantId)

      return circuitBreaker.execute(() =>
        withRetry(
          async () => {
            try {
              // Build multimodal prompt with media
              const mediaContents = input.attachments.map((attachment) => ({
                media: {
                  url: `data:${attachment.mimeType};base64,${attachment.data}`,
                },
              }))

              const result = await ai.generate({
                model: modelToUse,
                prompt: [...mediaContents, { text: input.prompt }],
                config: {
                  temperature: effectiveTemperature,
                  maxOutputTokens: effectiveMaxOutputTokens,
                  // Pass thinkingConfig when the caller sets thinkingBudget (including 0
                  // to explicitly disable thinking). Omit when undefined so non-thinking
                  // models are unaffected.
                  ...(input.model.thinkingBudget !== undefined
                    ? { thinkingConfig: { thinkingBudget: input.model.thinkingBudget } }
                    : {}),
                },
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
        ),
      )
    },

    /**
     * Generate chat completion with tools
     */
    generateChatCompletionWithTools: async (input: ToolCallingInput, payloadInstance: Payload) => {
      const modelKey = input.model.modelKey || 'EXERCISE_CHAT'
      const config = await resolveGenkitConfig(modelKey, tenantId, payloadInstance)

      const ai = await getGenkitInstance(payloadInstance, tenantId)

      return circuitBreaker.execute(() =>
        withRetry(
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

              const messages = buildGenkitMessages(input.system, input.messages)

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
        ),
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
