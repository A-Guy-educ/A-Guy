/**
 * OpenAI-Compatible Provider - Main API
 * Single entry point for all OpenAI-compatible API operations
 *
 * @public This is the ONLY file consumers should import from
 */
import type { AIModel } from '@/infra/llm/models'
import {
  createErrorClassifier,
  LLM_DEFAULTS,
  LLMError,
  LLMErrorCode,
  withRetry,
} from '@/infra/llm/providers/shared'
import { logger } from '@/infra/utils/logger'
import type { Payload } from 'payload'
import { getOpenAIClient } from './openai.client'
import {
  extractTextFromOpenAIResponse,
  mapMessagesToOpenAIFormat,
  type ChatMessage,
} from './openai.mapper'

// Provider identification for logging
const PROVIDER_NAME = 'openai-compatible'
const PROVIDER_VERSION = '1.0'

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

// AIModel is imported from centralized models.ts (re-exported for convenience)
export type { AIModel } from '@/infra/llm/models'

export interface GenerateChatInput {
  system: string
  messages: ChatMessage[]
  model: AIModel
  acknowledgment?: string
  timeoutMs?: number
}

export interface GenerateChatOutput {
  text: string
  raw?: unknown
}

export interface GenerateMultimodalInput {
  prompt: string
  model: AIModel
  attachments: Array<{
    data: string // base64 encoded
    mimeType: string // e.g., 'image/png'
  }>
  timeoutMs?: number
}

// Re-export from shared module for backwards compatibility
export { LLMError as OpenAIError, LLMErrorCode as OpenAIErrorCode }

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

// Error classifier for OpenAI
const { isRetryable, wrapError: wrapOpenAIError } = createErrorClassifier('openai')

// ─────────────────────────────────────────────────────────────────────────────
// Main API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a chat completion using OpenAI-compatible API
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Timeout handling
 * - Error normalization
 *
 * @param input - Chat input with system prompt, messages, and model config
 * @param payload - Optional Payload instance for runtime config access
 * @returns Chat output with response text
 * @throws OpenAIError on failure after retries
 */
export async function generateChatCompletion(
  input: GenerateChatInput,
  payload: Payload,
): Promise<GenerateChatOutput> {
  const timeoutMs = input.timeoutMs ?? LLM_DEFAULTS.chatTimeoutMs

  return withRetry<GenerateChatOutput, Error>(() => executeWithTimeout(input, timeoutMs, payload), {
    maxRetries: LLM_DEFAULTS.maxRetries,
    delayMs: LLM_DEFAULTS.retryDelayMs,
    isRetryable,
    wrapError: (e: Error) => wrapOpenAIError(e),
    logPrefix: '[OpenAIProvider]',
    onRetry: (error: Error, attempt: number) => {
      logger.warn({ err: error, attempt, retrying: true }, '[OpenAIProvider] Retrying after error')
    },
  })
}

/**
 * Generate a multimodal completion using OpenAI-compatible API
 *
 * Features:
 * - Supports file attachments (images) via base64
 * - Automatic retry with exponential backoff
 * - Timeout handling
 * - Error normalization
 *
 * @param input - Multimodal input with prompt, attachments, and model config
 * @param payload - Payload instance for config access
 * @returns Chat output with response text
 * @throws OpenAIError on failure after retries
 */
export async function generateMultimodalCompletion(
  input: GenerateMultimodalInput,
  payload: Payload,
): Promise<GenerateChatOutput> {
  const timeoutMs = input.timeoutMs ?? LLM_DEFAULTS.chatTimeoutMs

  return withRetry<GenerateChatOutput, Error>(
    () => executeMultimodalWithTimeout(input, timeoutMs, payload),
    {
      maxRetries: LLM_DEFAULTS.maxRetries,
      delayMs: LLM_DEFAULTS.retryDelayMs,
      isRetryable,
      wrapError: (e: Error) => wrapOpenAIError(e),
      logPrefix: '[OpenAIProvider]',
      onRetry: (error: Error, attempt: number) => {
        logger.warn(
          { err: error, attempt, retrying: true },
          '[OpenAIProvider] Retrying after error',
        )
      },
    },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Implementation
// ─────────────────────────────────────────────────────────────────────────────

async function executeWithTimeout(
  input: GenerateChatInput,
  timeoutMs: number,
  payload: Payload,
): Promise<GenerateChatOutput> {
  const client = await getOpenAIClient(payload)

  // Build messages array with system message first
  const allMessages: ChatMessage[] = [{ role: 'system', content: input.system }, ...input.messages]

  const messages = mapMessagesToOpenAIFormat(allMessages)

  // Log provider details for the request
  logger.info(
    {
      provider: PROVIDER_NAME,
      providerVersion: PROVIDER_VERSION,
      model: input.model.name,
      temperature: input.model.temperature,
      maxOutputTokens: input.model.maxOutputTokens,
      capabilities: input.model.capabilities ?? [],
      messageCount: messages.length,
      timeoutMs,
    },
    '[OpenAIProvider] Chat completion request',
  )

  const startTime = Date.now()

  // Create timeout promise
  const timeoutError = new Error(`Model call timed out after ${timeoutMs}ms`)
  timeoutError.name = 'TimeoutError'
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(timeoutError), timeoutMs)
  })

  // Execute chat with timeout
  const completionPromise = client.chat.completions.create({
    model: input.model.name,
    messages,
    temperature: input.model.temperature,
    max_tokens: input.model.maxOutputTokens,
  })

  const completion = (await Promise.race([completionPromise, timeoutPromise])) as {
    choices: Array<{ message: { content: string | null } }>
  }

  const processingTimeMs = Date.now() - startTime
  const text = extractTextFromOpenAIResponse(completion)

  // Log successful completion
  logger.info(
    {
      provider: PROVIDER_NAME,
      providerVersion: PROVIDER_VERSION,
      model: input.model.name,
      processingTimeMs,
      responseLength: text.length,
    },
    '[OpenAIProvider] Chat completion completed',
  )

  return {
    text,
    raw: completion,
  }
}

async function executeMultimodalWithTimeout(
  input: GenerateMultimodalInput,
  timeoutMs: number,
  payload: Payload,
): Promise<GenerateChatOutput> {
  const client = await getOpenAIClient(payload)

  // Log provider details for multimodal request
  logger.info(
    {
      provider: PROVIDER_NAME,
      providerVersion: PROVIDER_VERSION,
      model: input.model.name,
      temperature: input.model.temperature,
      maxOutputTokens: input.model.maxOutputTokens,
      capabilities: input.model.capabilities ?? [],
      promptLength: input.prompt.length,
      attachmentCount: input.attachments.length,
      mimeTypes: input.attachments.map((a) => a.mimeType),
      timeoutMs,
    },
    '[OpenAIProvider] Multimodal completion request',
  )

  const startTime = Date.now()

  // Build content array: text prompt + image attachments
  const content: Array<
    { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
  > = [{ type: 'text', text: input.prompt }]

  for (const attachment of input.attachments) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${attachment.mimeType};base64,${attachment.data}`,
      },
    })
  }

  // Create timeout promise
  const timeoutError = new Error(`Model call timed out after ${timeoutMs}ms`)
  timeoutError.name = 'TimeoutError'
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(timeoutError), timeoutMs)
  })

  // Execute multimodal request with timeout
  const completionPromise = client.chat.completions.create({
    model: input.model.name,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
    temperature: input.model.temperature,
    max_tokens: input.model.maxOutputTokens,
  })

  const completion = (await Promise.race([completionPromise, timeoutPromise])) as {
    choices: Array<{ message: { content: string | null } }>
  }

  const processingTimeMs = Date.now() - startTime
  const text = extractTextFromOpenAIResponse(completion)

  // Log successful completion
  logger.info(
    {
      provider: PROVIDER_NAME,
      providerVersion: PROVIDER_VERSION,
      model: input.model.name,
      processingTimeMs,
      responseLength: text.length,
    },
    '[OpenAIProvider] Multimodal completion completed',
  )

  return {
    text,
    raw: completion,
  }
}

export { isOpenAIApiKeyConfigured } from './openai.client'
