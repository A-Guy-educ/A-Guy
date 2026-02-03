/**
 * Gemini Provider - Public API
 * Single entry point for all Gemini AI operations
 *
 * @public This is the ONLY file consumers should import from
 */
import type { AIModel } from '@/infra/llm/models'
import { logger } from '@/infra/utils/logger'
import { getGeminiClient } from '@/server/llm/gemini.client'
import type { Payload } from 'payload'
import { isRetryableError, wrapGeminiError } from './gemini.errors'
import { extractResponseText, mapMessagesToGeminiHistory } from './gemini.mapper'

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// AIModel is imported from centralized models.ts (re-exported for convenience)
export type { AIModel } from '@/infra/llm/models'

export interface GenerateChatInput {
  system: string
  messages: ChatMessage[]
  model: AIModel
  acknowledgment: string
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
    mimeType: string // e.g., 'application/pdf'
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
 * Generate a chat completion using Gemini
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Timeout handling
 * - Error normalization
 *
 * @param input - Chat input with system prompt, messages, and model config
 * @param payload - Optional Payload instance for runtime config access
 * @returns Chat output with response text
 * @throws GeminiError on failure after retries
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
      const geminiError = wrapGeminiError(lastError)

      // Don't retry non-retryable errors
      if (!isRetryableError(lastError)) {
        logger.error({ err: lastError, attempt }, '[GeminiProvider] Non-retryable error')
        throw geminiError
      }

      // Retry with exponential backoff
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
        logger.warn(
          { err: lastError, attempt, delay, retrying: true },
          '[GeminiProvider] Retrying after error',
        )
        await sleep(delay)
      }
    }
  }

  // All retries exhausted
  logger.error({ err: lastError }, '[GeminiProvider] All retries exhausted')
  throw wrapGeminiError(lastError ?? new Error('Unknown error'))
}

/**
 * Generate a multimodal completion using Gemini
 *
 * Features:
 * - Supports file attachments (PDF, images) via base64 inline data
 * - Automatic retry with exponential backoff
 * - Timeout handling
 * - Error normalization
 *
 * @param input - Multimodal input with prompt, attachments, and model config
 * @param payload - Payload instance for config access
 * @returns Chat output with response text
 * @throws GeminiError on failure after retries
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
      const geminiError = wrapGeminiError(lastError)

      // Don't retry non-retryable errors
      if (!isRetryableError(lastError)) {
        logger.error({ err: lastError, attempt }, '[GeminiProvider] Non-retryable error')
        throw geminiError
      }

      // Retry with exponential backoff
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
        logger.warn(
          { err: lastError, attempt, delay, retrying: true },
          '[GeminiProvider] Retrying after error',
        )
        await sleep(delay)
      }
    }
  }

  // All retries exhausted
  logger.error({ err: lastError }, '[GeminiProvider] All retries exhausted')
  throw wrapGeminiError(lastError ?? new Error('Unknown error'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Implementation
// ─────────────────────────────────────────────────────────────────────────────

async function executeWithTimeout(
  input: GenerateChatInput,
  timeoutMs: number,
  payload: Payload,
): Promise<GenerateChatOutput> {
  const client = await getGeminiClient(payload)

  const model = client.getGenerativeModel({
    model: input.model.name,
    generationConfig: {
      temperature: input.model.temperature,
      maxOutputTokens: input.model.maxOutputTokens,
    },
  })

  // Build messages array with system message first
  const allMessages: ChatMessage[] = [{ role: 'system', content: input.system }, ...input.messages]

  // Get the current user message (last user message in the array)
  const userMessages = input.messages.filter((m) => m.role === 'user')
  const currentMessage =
    userMessages.length > 0 ? userMessages[userMessages.length - 1].content : ''

  // Map to Gemini format
  const { history, currentMessage: finalMessage } = mapMessagesToGeminiHistory(
    allMessages,
    currentMessage,
    input.acknowledgment,
  )

  logger.debug(
    {
      historyLength: history.length,
      messageCount: input.messages.length,
      currentMessagePreview: finalMessage.substring(0, 50),
    },
    '[GeminiProvider] Prepared chat history',
  )

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Model call timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  // Execute chat with timeout
  const chat = model.startChat({ history })
  const result = await Promise.race([chat.sendMessage(finalMessage), timeoutPromise])

  const text = extractResponseText(result.response)

  return {
    text,
    raw: result,
  }
}

async function executeMultimodalWithTimeout(
  input: GenerateMultimodalInput,
  timeoutMs: number,
  payload: Payload,
): Promise<GenerateChatOutput> {
  const client = await getGeminiClient(payload)

  const model = client.getGenerativeModel({
    model: input.model.name,
    generationConfig: {
      temperature: input.model.temperature,
      maxOutputTokens: input.model.maxOutputTokens,
    },
  })

  logger.debug(
    {
      promptLength: input.prompt.length,
      attachmentCount: input.attachments.length,
      mimeTypes: input.attachments.map((a) => a.mimeType),
    },
    '[GeminiProvider] Preparing multimodal request',
  )

  // Build parts array: text prompt + inline data attachments
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: input.prompt },
  ]

  for (const attachment of input.attachments) {
    parts.push({
      inlineData: {
        data: attachment.data,
        mimeType: attachment.mimeType,
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
  const result = await Promise.race([
    model.generateContent({ contents: [{ role: 'user', parts }] }),
    timeoutPromise,
  ])

  const text = extractResponseText(result.response)

  return {
    text,
    raw: result,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports for convenience
// ─────────────────────────────────────────────────────────────────────────────

export { isGeminiApiKeyConfigured } from '@/server/llm/gemini.client'
export { GeminiError, GeminiErrorCode } from './gemini.errors'
