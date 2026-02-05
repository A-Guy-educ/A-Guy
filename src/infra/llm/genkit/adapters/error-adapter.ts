/**
 * Error Adapter
 * Maps Genkit errors to LLMError for consistent error handling
 *
 * @fileType adapter
 * @domain ai
 * @pattern error-handling, genkit
 *
 * Reuses existing LLMError and createErrorClassifier from shared/errors.ts
 */
import { LLMError, LLMErrorCode, createErrorClassifier } from '@/infra/llm/providers/shared/errors'
import { LLMProviderType } from '@/infra/llm/providers/types'

/**
 * Create an error adapter for Genkit errors
 * Wraps Genkit errors in LLMError with proper classification
 */
export function createGenkitErrorAdapter(providerType: LLMProviderType) {
  const classifier = createErrorClassifier(providerType)

  /**
   * Check if a Genkit error is retryable
   */
  const isRetryable = (error: Error): boolean => {
    // Check for specific Genkit error patterns
    const message = error.message.toLowerCase()

    // Non-retryable patterns
    if (
      message.includes('api key') ||
      message.includes('invalid API key') ||
      message.includes('authentication') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      return false
    }

    // Retryable patterns
    if (
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('timeout') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('network') ||
      message.includes('ECONNRESET') ||
      message.includes('ETIMEDOUT')
    ) {
      return true
    }

    // Fall back to classifier
    return classifier.isRetryable(error)
  }

  /**
   * Wrap a Genkit error in LLMError
   */
  const wrapError = (error: Error, defaultCode?: LLMErrorCode): LLMError => {
    const message = error.message.toLowerCase()

    // Map Genkit-specific error messages to LLMError codes
    if (
      message.includes('api key') ||
      message.includes('no api key') ||
      message.includes('authentication') ||
      message.includes('credential')
    ) {
      return new LLMError(error.message, LLMErrorCode.CONFIG_ERROR, providerType, false, error)
    }

    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('deadline exceeded')
    ) {
      return new LLMError(
        `${providerType} API request timed out`,
        LLMErrorCode.TIMEOUT_ERROR,
        providerType,
        true,
        error,
      )
    }

    if (
      message.includes('rate limit') ||
      message.includes('quota') ||
      message.includes('429') ||
      message.includes('too many requests')
    ) {
      return new LLMError(
        `${providerType} API rate limit exceeded`,
        LLMErrorCode.RATE_LIMIT_ERROR,
        providerType,
        true,
        error,
      )
    }

    if (
      message.includes('invalid') ||
      message.includes('validation') ||
      message.includes('400') ||
      message.includes(' malformed')
    ) {
      return new LLMError(error.message, LLMErrorCode.VALIDATION_ERROR, providerType, false, error)
    }

    // Default to classifier for other cases
    return classifier.wrapError(error, defaultCode)
  }

  return {
    isRetryable,
    wrapError,
  }
}

/**
 * Create error adapter for Gemini provider
 */
export const geminiErrorAdapter = createGenkitErrorAdapter(LLMProviderType.GEMINI)

/**
 * Create error adapter for OpenAI-compatible provider
 */
export const openaiErrorAdapter = createGenkitErrorAdapter(LLMProviderType.OPENAI_COMPATIBLE)

/**
 * Get the appropriate error adapter for a provider type
 */
export function getErrorAdapter(providerType: LLMProviderType) {
  switch (providerType) {
    case LLMProviderType.GEMINI:
      return geminiErrorAdapter
    case LLMProviderType.OPENAI_COMPATIBLE:
      return openaiErrorAdapter
    default:
      return createGenkitErrorAdapter(providerType)
  }
}
