/**
 * Runtime Config Validation Utility
 *
 * @fileType implementation
 * @domain config.validation
 * @pattern runtime-validation, config-sanity-check
 * @ai-summary Validates chat configuration values at runtime to ensure required paths exist and values are within expected ranges
 */

import { getChatConfig } from '@/infra/llm/providers/shared/chat-config'

/**
 * Helper to get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.')
  let value: unknown = obj

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }

  return value
}

/**
 * Validate chat configuration at runtime
 *
 * @returns Validation result with errors and warnings
 */
export async function validateChatConfig(): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
}> {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    const config = await getChatConfig()

    // Required paths (matches ChatConfig interface)
    const requiredPaths = [
      'chatSettings.defaultChatTimeoutMs',
      'chatSettings.defaultMaxRetries',
      'chatSettings.defaultRetryDelayMs',
      'chatSettings.defaultToolTimeoutMs',
      'chatSettings.maxToolIterations',
      'retry.maxRetries',
      'retry.delayMs',
      'retry.exponentialBase',
      'retry.jitterFactor',
      'temperature.default',
      'temperature.min',
      'temperature.max',
      'tokens.defaultMax',
      'tokens.maxMax',
      'multipart.maxImages',
      'multipart.maxSizeMb',
      'multipart.supportedImages',
      'multipart.supportedPdfs',
      'models.exerciseChat',
      'models.imageToExercise',
      'models.pdfToExercise',
    ]

    for (const path of requiredPaths) {
      const value = getNestedValue(config as unknown as Record<string, unknown>, path)
      if (value === undefined) {
        errors.push(`Missing required config: ${path}`)
      }
    }

    // Type validations
    if (typeof config.chatSettings?.defaultChatTimeoutMs !== 'number') {
      errors.push('chatSettings.defaultChatTimeoutMs must be a number')
    }

    if (typeof config.chatSettings?.defaultMaxRetries !== 'number') {
      errors.push('chatSettings.defaultMaxRetries must be a number')
    }

    if (typeof config.chatSettings?.defaultRetryDelayMs !== 'number') {
      errors.push('chatSettings.defaultRetryDelayMs must be a number')
    }

    if (typeof config.chatSettings?.defaultToolTimeoutMs !== 'number') {
      errors.push('chatSettings.defaultToolTimeoutMs must be a number')
    }

    if (typeof config.chatSettings?.maxToolIterations !== 'number') {
      errors.push('chatSettings.maxToolIterations must be a number')
    }

    if (typeof config.retry?.maxRetries !== 'number') {
      errors.push('retry.maxRetries must be a number')
    }

    if (typeof config.retry?.delayMs !== 'number') {
      errors.push('retry.delayMs must be a number')
    }

    if (typeof config.retry?.exponentialBase !== 'number') {
      errors.push('retry.exponentialBase must be a number')
    }

    if (typeof config.retry?.jitterFactor !== 'number') {
      errors.push('retry.jitterFactor must be a number')
    }

    if (typeof config.temperature?.default !== 'number') {
      errors.push('temperature.default must be a number')
    }

    // Value range validations
    if (
      config.temperature?.default !== undefined &&
      config.temperature?.min !== undefined &&
      config.temperature?.max !== undefined
    ) {
      if (
        config.temperature.default < config.temperature.min ||
        config.temperature.default > config.temperature.max
      ) {
        errors.push(
          `temperature.default (${config.temperature.default}) must be between min (${config.temperature.min}) and max (${config.temperature.max})`,
        )
      }
    }

    // Temperature bounds sanity check
    if (config.temperature?.min !== undefined && config.temperature?.max !== undefined) {
      if (config.temperature.min >= config.temperature.max) {
        errors.push('temperature.min must be less than temperature.max')
      }
    }

    // Retry config sanity checks
    if (config.retry?.maxRetries !== undefined && config.retry.maxRetries < 0) {
      errors.push('retry.maxRetries must be non-negative')
    }

    if (config.retry?.delayMs !== undefined && config.retry.delayMs < 0) {
      errors.push('retry.delayMs must be non-negative')
    }

    if (config.retry?.exponentialBase !== undefined && config.retry.exponentialBase < 1) {
      errors.push('retry.exponentialBase must be >= 1')
    }

    if (config.retry?.jitterFactor !== undefined) {
      if (config.retry.jitterFactor < 0 || config.retry.jitterFactor > 1) {
        errors.push('retry.jitterFactor must be between 0 and 1')
      }
    }

    // Token limits sanity check
    if (config.tokens?.defaultMax !== undefined && config.tokens?.maxMax !== undefined) {
      if (config.tokens.defaultMax > config.tokens.maxMax) {
        warnings.push(
          'tokens.defaultMax is greater than tokens.maxMax - this may limit model choices',
        )
      }
    }

    // Timeout sanity checks
    if (
      config.chatSettings?.defaultChatTimeoutMs !== undefined &&
      config.chatSettings.defaultChatTimeoutMs < 1000
    ) {
      warnings.push(
        'chatSettings.defaultChatTimeoutMs is less than 1 second - may be too short for production',
      )
    }

    if (
      config.chatSettings?.defaultToolTimeoutMs !== undefined &&
      config.chatSettings.defaultToolTimeoutMs < 1000
    ) {
      warnings.push(
        'chatSettings.defaultToolTimeoutMs is less than 1 second - may be too short for production',
      )
    }

    // Tool iterations sanity check
    if (config.chatSettings?.maxToolIterations !== undefined) {
      if (config.chatSettings.maxToolIterations < 1) {
        errors.push('chatSettings.maxToolIterations must be at least 1')
      }
      if (config.chatSettings.maxToolIterations > 50) {
        warnings.push(
          'chatSettings.maxToolIterations is very high (>50) - may lead to long-running operations',
        )
      }
    }

    // Multipart config validations
    if (config.multipart?.maxImages !== undefined && config.multipart.maxImages < 0) {
      errors.push('multipart.maxImages must be non-negative')
    }

    if (config.multipart?.maxSizeMb !== undefined && config.multipart.maxSizeMb < 0) {
      errors.push('multipart.maxSizeMb must be non-negative')
    }

    if (
      !Array.isArray(config.multipart?.supportedImages) ||
      config.multipart.supportedImages.length === 0
    ) {
      errors.push('multipart.supportedImages must be a non-empty array')
    }

    if (
      !Array.isArray(config.multipart?.supportedPdfs) ||
      config.multipart.supportedPdfs.length === 0
    ) {
      errors.push('multipart.supportedPdfs must be a non-empty array')
    }

    // Model config validations
    const modelTasks = ['exerciseChat', 'imageToExercise', 'pdfToExercise'] as const
    for (const task of modelTasks) {
      const modelConfig = config.models?.[task]
      if (!modelConfig) {
        errors.push(`models.${task} is missing`)
        continue
      }

      if (typeof modelConfig.gemini !== 'string' || !modelConfig.gemini) {
        errors.push(`models.${task}.gemini must be a non-empty string`)
      }

      if (typeof modelConfig.openaiCompatible !== 'string' || !modelConfig.openaiCompatible) {
        errors.push(`models.${task}.openaiCompatible must be a non-empty string`)
      }

      if (typeof modelConfig.maxOutputTokens !== 'number' || modelConfig.maxOutputTokens <= 0) {
        errors.push(`models.${task}.maxOutputTokens must be a positive number`)
      }

      if (!Array.isArray(modelConfig.capabilities) || modelConfig.capabilities.length === 0) {
        errors.push(`models.${task}.capabilities must be a non-empty array`)
      }
    }

    // Consistency warnings
    if (config.retry?.maxRetries !== config.chatSettings?.defaultMaxRetries) {
      warnings.push(
        'retry.maxRetries differs from chatSettings.defaultMaxRetries - consider consolidating',
      )
    }

    if (config.retry?.delayMs !== config.chatSettings?.defaultRetryDelayMs) {
      warnings.push(
        'retry.delayMs differs from chatSettings.defaultRetryDelayMs - consider consolidating',
      )
    }

    return { valid: errors.length === 0, errors, warnings }
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Failed to load config: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
      warnings: [],
    }
  }
}

/**
 * Validate chat config synchronously using raw config object
 * Useful for testing without loading from database
 */
export function validateChatConfigSync(config: Record<string, unknown>): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Required paths check
  const requiredPaths = [
    'chatSettings.defaultChatTimeoutMs',
    'chatSettings.defaultMaxRetries',
    'chatSettings.defaultRetryDelayMs',
    'chatSettings.defaultToolTimeoutMs',
    'chatSettings.maxToolIterations',
    'retry.maxRetries',
    'retry.delayMs',
    'retry.exponentialBase',
    'retry.jitterFactor',
    'temperature.default',
    'temperature.min',
    'temperature.max',
    'tokens.defaultMax',
    'tokens.maxMax',
    'multipart.maxImages',
    'multipart.maxSizeMb',
    'multipart.supportedImages',
    'multipart.supportedPdfs',
    'models.exerciseChat',
    'models.imageToExercise',
    'models.pdfToExercise',
  ]

  for (const path of requiredPaths) {
    const value = getNestedValue(config, path)
    if (value === undefined) {
      errors.push(`Missing required config: ${path}`)
    }
  }

  // Type and value validations
  const chatSettings = config.chatSettings as Record<string, unknown> | undefined
  const retry = config.retry as Record<string, unknown> | undefined
  const temperature = config.temperature as Record<string, unknown> | undefined
  const tokens = config.tokens as Record<string, unknown> | undefined
  const _multipart = config.multipart as Record<string, unknown> | undefined // Keep for future use

  if (typeof chatSettings?.defaultChatTimeoutMs !== 'number') {
    errors.push('chatSettings.defaultChatTimeoutMs must be a number')
  }

  if (typeof chatSettings?.defaultMaxRetries !== 'number') {
    errors.push('chatSettings.defaultMaxRetries must be a number')
  }

  if (typeof chatSettings?.defaultRetryDelayMs !== 'number') {
    errors.push('chatSettings.defaultRetryDelayMs must be a number')
  }

  if (typeof chatSettings?.defaultToolTimeoutMs !== 'number') {
    errors.push('chatSettings.defaultToolTimeoutMs must be a number')
  }

  if (typeof chatSettings?.maxToolIterations !== 'number') {
    errors.push('chatSettings.maxToolIterations must be a number')
  }

  if (typeof retry?.maxRetries !== 'number') {
    errors.push('retry.maxRetries must be a number')
  }

  if (typeof retry?.delayMs !== 'number') {
    errors.push('retry.delayMs must be a number')
  }

  if (typeof retry?.exponentialBase !== 'number') {
    errors.push('retry.exponentialBase must be a number')
  }

  if (typeof retry?.jitterFactor !== 'number') {
    errors.push('retry.jitterFactor must be a number')
  }

  if (typeof temperature?.default !== 'number') {
    errors.push('temperature.default must be a number')
  }

  // Value range validations
  if (
    temperature?.default !== undefined &&
    temperature?.min !== undefined &&
    temperature?.max !== undefined
  ) {
    const tempDefault = temperature.default as number
    const tempMin = temperature.min as number
    const tempMax = temperature.max as number

    if (tempDefault < tempMin || tempDefault > tempMax) {
      errors.push(`temperature.default must be between min and max`)
    }
  }

  if (temperature?.min !== undefined && temperature?.max !== undefined) {
    if ((temperature.min as number) >= (temperature.max as number)) {
      errors.push('temperature.min must be less than temperature.max')
    }
  }

  if (retry?.exponentialBase !== undefined && (retry.exponentialBase as number) < 1) {
    errors.push('retry.exponentialBase must be >= 1')
  }

  if (retry?.jitterFactor !== undefined) {
    const jitter = retry.jitterFactor as number
    if (jitter < 0 || jitter > 1) {
      errors.push('retry.jitterFactor must be between 0 and 1')
    }
  }

  if (tokens?.defaultMax !== undefined && tokens?.maxMax !== undefined) {
    if ((tokens.defaultMax as number) > (tokens.maxMax as number)) {
      warnings.push('tokens.defaultMax is greater than tokens.maxMax')
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}
