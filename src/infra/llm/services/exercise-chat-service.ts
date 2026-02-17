/**
 * AI Chat Service for Exercise Help
 * Orchestrates chat with AI providers using Genkit unified adapter
 *
 * Migrated from factory pattern to Genkit for unified LLM operations.
 * Supports Gemini and OpenAI-compatible providers via createGenkitUnifiedAdapter.
 */
import type { Payload } from 'payload'

import { logger } from '@/infra/utils/logger'

import type { ComposedPrompt } from '../context-policy'
import { createGenkitUnifiedAdapter } from '../genkit/adapters/unified-adapter'
import type { AIModel, AIModelKey } from '../models'
import type { MediaPartWithPath } from '../multimodal/types'
import { LLMProviderType } from '../providers/types'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  hidden?: boolean
  media?: Array<{ mediaId: string }>
}

export interface ExerciseChatInput {
  message: string
  acknowledgment: string
  conversationHistory?: ChatMessage[]
  composedPrompt?: ComposedPrompt
  /** Media attachments for multimodal messages */
  mediaPartsWithPath?: MediaPartWithPath[]
  /** Request context for auth headers (serverless compatibility) */
  req?: { headers: { authorization?: string; cookie?: string } }
}

export interface ExerciseChatResult {
  success: boolean
  message?: string
  error?: string
}

// Fallback for legacy callers (deprecated)
const LEGACY_FALLBACK = 'You are a helpful assistant.'

/**
 * @deprecated Use resolveAgentSystemPrompt from prompt-resolver.server instead.
 */
export function getSystemPrompt(): string {
  logger.warn('[DEPRECATED] getSystemPrompt() called - migrate to prompt resolver')
  return LEGACY_FALLBACK
}

/**
 * ChatMessage type used internally (local definition, replaces ProviderChatMessage)
 */
type InternalChatMessage = { role: 'user' | 'assistant'; content: string }

export async function chatWithExerciseHelper(
  input: ExerciseChatInput,
  payload: Payload,
): Promise<ExerciseChatResult> {
  try {
    // Get Genkit-backed unified adapter (replaces factory pattern)
    const adapter = await createGenkitUnifiedAdapter(payload)

    // Resolve model configuration
    const modelConfig = await resolveModelConfig('EXERCISE_CHAT')

    // Build messages from composedPrompt or legacy format
    let systemPrompt: string
    let messages: InternalChatMessage[]

    if (input.composedPrompt) {
      // Extract system from composed prompt
      const systemMsg = input.composedPrompt.messages.find((m) => m.role === 'system')
      systemPrompt = systemMsg?.content ?? LEGACY_FALLBACK

      // Convert to provider format
      messages = input.composedPrompt.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
    } else {
      // Legacy path
      systemPrompt = getSystemPrompt()
      messages =
        input.conversationHistory?.map((m) => ({
          role: m.role,
          content: m.content,
        })) ?? []
      // Add current message
      messages.push({ role: 'user', content: input.message })
    }

    // Handle multimodal content if media is attached
    if (input.mediaPartsWithPath && input.mediaPartsWithPath.length > 0) {
      return await sendMultimodalToGenkit(
        systemPrompt,
        input.message,
        input.mediaPartsWithPath,
        modelConfig,
        payload,
        input.req,
      )
    }

    // Text-only path using unified Genkit adapter
    const result = await adapter.generateChatCompletion(
      {
        system: systemPrompt,
        messages,
        model: modelConfig,
        acknowledgment: input.acknowledgment,
      },
      payload,
    )

    return {
      success: true,
      message: result.text,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error({ err: error }, '[ExerciseChat] Chat failed')

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Streaming chat result interface
 */
export interface StreamingChatResult {
  stream: AsyncIterable<{ text: string }>
  response: Promise<{ text: string }>
}

/**
 * Stream chat with exercise helper
 * Returns a stream of chunks and a promise that resolves when streaming is complete
 * Throws if the provider doesn't support streaming
 */
export async function streamChatWithExerciseHelper(
  input: ExerciseChatInput,
  payload: Payload,
): Promise<StreamingChatResult> {
  // Check for media - streaming doesn't support multimodal
  if (input.mediaPartsWithPath && input.mediaPartsWithPath.length > 0) {
    throw new Error('Multimedia content is not supported in streaming mode')
  }

  // Get Genkit-backed unified adapter
  const adapter = await createGenkitUnifiedAdapter(payload)

  // Check if streaming is supported
  if (!adapter.generateStreamingChatCompletion) {
    throw new Error('Streaming is not supported by the current LLM provider')
  }

  // Resolve model configuration
  const modelConfig = await resolveModelConfig('EXERCISE_CHAT')

  // Build messages from composedPrompt or legacy format
  let systemPrompt: string
  let messages: InternalChatMessage[]

  if (input.composedPrompt) {
    // Extract system from composed prompt
    const systemMsg = input.composedPrompt.messages.find((m) => m.role === 'system')
    systemPrompt = systemMsg?.content ?? LEGACY_FALLBACK

    // Convert to provider format
    messages = input.composedPrompt.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
  } else {
    // Legacy path
    systemPrompt = getSystemPrompt()
    messages =
      input.conversationHistory?.map((m) => ({
        role: m.role,
        content: m.content,
      })) ?? []
    // Add current message
    messages.push({ role: 'user', content: input.message })
  }

  // Call streaming API
  return adapter.generateStreamingChatCompletion(
    {
      system: systemPrompt,
      messages,
      model: modelConfig,
      acknowledgment: input.acknowledgment,
    },
    payload,
  )
}

/**
 * Resolve model config from MODEL_REGISTRY (mirrors getProviderModelConfig)
 */
async function resolveModelConfig(modelKey: AIModelKey): Promise<AIModel> {
  const { getModelRegistryEntry, getProviderModelName } = await import('../models')
  const entry = getModelRegistryEntry(modelKey)
  return {
    name: getProviderModelName(LLMProviderType.GEMINI, modelKey),
    ...entry,
  }
}

/**
 * Send multimodal content (text + media) using Genkit adapter
 * Fetches media via publicUrl with forwarded auth cookies (serverless compatible)
 */
async function sendMultimodalToGenkit(
  systemPrompt: string,
  userMessage: string,
  mediaPartsWithPath: MediaPartWithPath[],
  model: AIModel,
  payload: Payload,
  reqContext?: { headers: { authorization?: string; cookie?: string } },
): Promise<ExerciseChatResult> {
  // Convert media parts to Genkit-compatible base64 attachments
  // Uses publicUrl (absolute URL built from request origin) with forwarded cookies
  const attachments: Array<{ data: string; mimeType: string }> = []

  // Build fetch headers with forwarded auth cookies for server-to-server calls
  const fetchHeaders: Record<string, string> = {}
  if (reqContext?.headers.cookie) {
    fetchHeaders.cookie = reqContext.headers.cookie
  }
  if (reqContext?.headers.authorization) {
    fetchHeaders.authorization = reqContext.headers.authorization
  }

  for (const mediaPart of mediaPartsWithPath) {
    try {
      if (!mediaPart.publicUrl) {
        logger.warn({ mediaId: mediaPart.mediaId }, '[ExerciseChat] Media part has no publicUrl')
        continue
      }

      const response = await fetch(mediaPart.publicUrl, {
        headers: fetchHeaders,
      })
      if (!response.ok) {
        logger.warn(
          { mediaId: mediaPart.mediaId, status: response.status, url: mediaPart.publicUrl },
          '[ExerciseChat] Failed to fetch media - non-OK response',
        )
        continue
      }
      const arrayBuffer = await response.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')

      attachments.push({
        data: base64,
        mimeType: mediaPart.mimeType || 'image/jpeg',
      })
    } catch (fetchError) {
      logger.warn(
        { err: fetchError, mediaId: mediaPart.mediaId },
        '[ExerciseChat] Failed to fetch media',
      )
    }
  }

  logger.info(
    {
      mediaInputCount: mediaPartsWithPath.length,
      attachmentsCount: attachments.length,
    },
    '[ExerciseChat] Multimodal attachments prepared for Genkit',
  )

  if (attachments.length === 0) {
    return {
      success: false,
      error: 'No valid media attachments found',
    }
  }

  try {
    // Use Genkit unified adapter for multimodal
    const adapter = await createGenkitUnifiedAdapter(payload)
    const result = await adapter.generateMultimodalCompletion(
      {
        prompt: `${systemPrompt}\n\n${userMessage}`,
        model,
        attachments,
      },
      payload,
    )

    return {
      success: true,
      message: result.text,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error({ err: error }, '[ExerciseChat] Multimodal Genkit call failed')
    return {
      success: false,
      error: errorMessage,
    }
  }
}
