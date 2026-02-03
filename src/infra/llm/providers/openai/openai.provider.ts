/**
 * OpenAI-Compatible Provider - Main API
 * Single entry point for all OpenAI-compatible API operations
 *
 * @public This is the ONLY file consumers should import from
 */
import type { AIModel } from '@/infra/llm/models'
import { logger } from '@/infra/utils/logger'
import type { Payload } from 'payload'
import { getOpenAIClient } from './openai.client'
import { isRetryableOpenAIError, wrapOpenAIError } from './openai.errors'
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

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1_000

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
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await executeWithTimeout(input, timeoutMs, payload)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const openaiError = wrapOpenAIError(lastError)

      // Don't retry non-retryable errors
      if (!isRetryableOpenAIError(lastError)) {
        logger.error({ err: lastError, attempt }, '[OpenAIProvider] Non-retryable error')
        throw openaiError
      }

      // Retry with exponential backoff
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
        logger.warn(
          { err: lastError, attempt, delay, retrying: true },
          '[OpenAIProvider] Retrying after error',
        )
        await sleep(delay)
      }
    }
  }

  // All retries exhausted
  logger.error({ err: lastError }, '[OpenAIProvider] All retries exhausted')
  throw wrapOpenAIError(lastError ?? new Error('Unknown error'))
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
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await executeMultimodalWithTimeout(input, timeoutMs, payload)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const openaiError = wrapOpenAIError(lastError)

      // Don't retry non-retryable errors
      if (!isRetryableOpenAIError(lastError)) {
        logger.error({ err: lastError, attempt }, '[OpenAIProvider] Non-retryable error')
        throw openaiError
      }

      // Retry with exponential backoff
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
        logger.warn(
          { err: lastError, attempt, delay, retrying: true },
          '[OpenAIProvider] Retrying after error',
        )
        await sleep(delay)
      }
    }
  }

  // All retries exhausted
  logger.error({ err: lastError }, '[OpenAIProvider] All retries exhausted')
  throw wrapOpenAIError(lastError ?? new Error('Unknown error'))
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
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Model call timed out after ${timeoutMs}ms`))
    }, timeoutMs)
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
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Model call timed out after ${timeoutMs}ms`))
    }, timeoutMs)
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports for convenience
// ─────────────────────────────────────────────────────────────────────────────

export { isOpenAIApiKeyConfigured } from './openai.client'
export { OpenAIError, OpenAIErrorCode } from './openai.errors'
