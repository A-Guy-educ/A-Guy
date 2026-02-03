/**
 * Input Validation for LLM Providers
 * Validates chat input before sending to LLM APIs
 *
 * @fileType validation
 * @domain ai
 */
import { LLM_CONSTANTS } from './constants'
import { LLMError, LLMErrorCode } from './errors'

/**
 * Input for chat completion generation
 */
export interface GenerateChatInput {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  model: {
    temperature?: number
    maxOutputTokens?: number
  }
}

/**
 * Input for multimodal completion
 */
export interface GenerateMultimodalInput {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  mediaParts: Array<{
    mediaId: string
    absoluteFilePath: string
    publicUrl: string
    mimeType: string
  }>
  model: {
    temperature?: number
    maxOutputTokens?: number
  }
}

/**
 * Validate chat completion input
 */
export function validateChatInput(input: GenerateChatInput, provider: string): void {
  if (!input.messages) {
    throw new LLMError('Messages array is required', LLMErrorCode.VALIDATION_ERROR, provider, false)
  }

  if (!Array.isArray(input.messages)) {
    throw new LLMError('Messages must be an array', LLMErrorCode.VALIDATION_ERROR, provider, false)
  }

  if (input.messages.length === 0) {
    throw new LLMError(
      'Messages array cannot be empty',
      LLMErrorCode.VALIDATION_ERROR,
      provider,
      false,
    )
  }

  for (let i = 0; i < input.messages.length; i++) {
    const msg = input.messages[i]

    if (!msg || typeof msg !== 'object') {
      throw new LLMError(
        `Invalid message at index ${i}`,
        LLMErrorCode.VALIDATION_ERROR,
        provider,
        false,
      )
    }

    if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
      throw new LLMError(
        `Invalid role "${msg.role}" at message index ${i}. Must be 'user', 'assistant', or 'system'`,
        LLMErrorCode.VALIDATION_ERROR,
        provider,
        false,
      )
    }

    if (typeof msg.content !== 'string') {
      throw new LLMError(
        `Invalid content type at message index ${i}. Content must be a string`,
        LLMErrorCode.VALIDATION_ERROR,
        provider,
        false,
      )
    }
  }

  if (input.model) {
    if (input.model.temperature !== undefined) {
      if (typeof input.model.temperature !== 'number') {
        throw new LLMError(
          'Temperature must be a number',
          LLMErrorCode.VALIDATION_ERROR,
          provider,
          false,
        )
      }

      if (
        input.model.temperature < LLM_CONSTANTS.MIN_TEMPERATURE ||
        input.model.temperature > LLM_CONSTANTS.MAX_TEMPERATURE
      ) {
        throw new LLMError(
          `Temperature must be between ${LLM_CONSTANTS.MIN_TEMPERATURE} and ${LLM_CONSTANTS.MAX_TEMPERATURE}`,
          LLMErrorCode.VALIDATION_ERROR,
          provider,
          false,
        )
      }
    }

    if (input.model.maxOutputTokens !== undefined) {
      if (typeof input.model.maxOutputTokens !== 'number') {
        throw new LLMError(
          'maxOutputTokens must be a number',
          LLMErrorCode.VALIDATION_ERROR,
          provider,
          false,
        )
      }

      if (input.model.maxOutputTokens <= 0) {
        throw new LLMError(
          'maxOutputTokens must be positive',
          LLMErrorCode.VALIDATION_ERROR,
          provider,
          false,
        )
      }

      if (input.model.maxOutputTokens > LLM_CONSTANTS.MAX_MAX_TOKENS) {
        throw new LLMError(
          `maxOutputTokens cannot exceed ${LLM_CONSTANTS.MAX_MAX_TOKENS}`,
          LLMErrorCode.VALIDATION_ERROR,
          provider,
          false,
        )
      }
    }
  }
}

/**
 * Validate multimodal input
 */
export function validateMultimodalInput(input: GenerateMultimodalInput, provider: string): void {
  validateChatInput(
    {
      messages: input.messages,
      model: input.model,
    },
    provider,
  )

  if (!input.mediaParts) {
    throw new LLMError(
      'Media parts array is required for multimodal input',
      LLMErrorCode.VALIDATION_ERROR,
      provider,
      false,
    )
  }

  if (!Array.isArray(input.mediaParts)) {
    throw new LLMError(
      'Media parts must be an array',
      LLMErrorCode.VALIDATION_ERROR,
      provider,
      false,
    )
  }

  if (input.mediaParts.length > LLM_CONSTANTS.MAX_MULTIPART_IMAGES) {
    throw new LLMError(
      `Cannot process more than ${LLM_CONSTANTS.MAX_MULTIPART_IMAGES} media parts`,
      LLMErrorCode.VALIDATION_ERROR,
      provider,
      false,
    )
  }

  for (let i = 0; i < input.mediaParts.length; i++) {
    const part = input.mediaParts[i]

    if (!part || typeof part !== 'object') {
      throw new LLMError(
        `Invalid media part at index ${i}`,
        LLMErrorCode.VALIDATION_ERROR,
        provider,
        false,
      )
    }

    if (!part.mediaId) {
      throw new LLMError(
        `Missing mediaId at media part index ${i}`,
        LLMErrorCode.VALIDATION_ERROR,
        provider,
        false,
      )
    }

    if (!part.absoluteFilePath) {
      throw new LLMError(
        `Missing absoluteFilePath at media part index ${i}`,
        LLMErrorCode.VALIDATION_ERROR,
        provider,
        false,
      )
    }

    if (!part.mimeType) {
      throw new LLMError(
        `Missing mimeType at media part index ${i}`,
        LLMErrorCode.VALIDATION_ERROR,
        provider,
        false,
      )
    }

    const mimeType = part.mimeType
    const isValidMimeType =
      (LLM_CONSTANTS.SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mimeType) ||
      (LLM_CONSTANTS.SUPPORTED_PDF_TYPES as readonly string[]).includes(mimeType)

    if (!isValidMimeType) {
      throw new LLMError(
        `Unsupported mime type "${part.mimeType}" at media part index ${i}`,
        LLMErrorCode.VALIDATION_ERROR,
        provider,
        false,
      )
    }
  }
}
