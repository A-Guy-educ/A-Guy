/**
 * LLM Provider Constants
 * Centralized constants and defaults for LLM operations
 *
 * @fileType constants
 * @domain ai
 */

// Timeouts for different operation types (in milliseconds)
export const LLM_TIMEOUTS = {
  DEFAULT: 30_000,
  TOOL_CALL: 60_000,
  STREAMING: 60_000,
} as const

// Retry configuration
export const LLM_RETRY = {
  MAX_RETRIES: 2,
  DELAY_MS: 1000,
  EXPONENTIAL_BASE: 2,
  JITTER_FACTOR: 0.1,
} as const

// Token limits
export const LLM_TOKENS = {
  DEFAULT_MAX: 4096,
  MAX_MAX: 128_000,
} as const

// Temperature range
export const LLM_TEMPERATURE = {
  MIN: 0,
  MAX: 2,
  DEFAULT: 0.7,
} as const

// Multipart/media handling
export const LLM_MULTIPART = {
  MAX_IMAGES: 10,
  MAX_SIZE_MB: 20,
  SUPPORTED_IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  SUPPORTED_PDFS: ['application/pdf'],
} as const

// Provider-specific URLs
export const LLM_PROVIDER_URLS = {
  GEMINI_API_BASE: 'https://generativelanguage.googleapis.com/v1beta',
  OPENAI_API_BASE: 'https://api.openai.com/v1',
} as const

// Default models
export const LLM_DEFAULT_MODELS = {
  GEMINI: 'gemini-3.1-flash-lite-preview',
  OPENAI: 'gpt-4o',
} as const

/**
 * Unified defaults derived from specialized constants
 * Used when simple defaults are needed
 */
export const LLM_DEFAULTS = {
  maxRetries: LLM_RETRY.MAX_RETRIES,
  retryDelayMs: LLM_RETRY.DELAY_MS,
  chatTimeoutMs: LLM_TIMEOUTS.DEFAULT,
  toolTimeoutMs: LLM_TIMEOUTS.TOOL_CALL,
  maxToolIterations: 5,
} as const

/**
 * Provider-specific configuration constants
 */
export const LLM_CONSTANTS = {
  // Provider-specific URLs
  GEMINI_API_BASE_URL: LLM_PROVIDER_URLS.GEMINI_API_BASE,
  OPENAI_API_BASE_URL: LLM_PROVIDER_URLS.OPENAI_API_BASE,

  // Default models
  GEMINI_DEFAULT_MODEL: LLM_DEFAULT_MODELS.GEMINI,
  OPENAI_DEFAULT_MODEL: LLM_DEFAULT_MODELS.OPENAI,

  // Timeout values (in milliseconds)
  DEFAULT_TIMEOUT: LLM_TIMEOUTS.DEFAULT,
  TOOL_CALL_TIMEOUT: LLM_TIMEOUTS.TOOL_CALL,
  STREAMING_TIMEOUT: LLM_TIMEOUTS.STREAMING,

  // Retry configuration
  DEFAULT_MAX_RETRIES: LLM_RETRY.MAX_RETRIES,
  DEFAULT_RETRY_DELAY: LLM_RETRY.DELAY_MS,
  EXPONENTIAL_BASE: LLM_RETRY.EXPONENTIAL_BASE,
  JITTER_FACTOR: LLM_RETRY.JITTER_FACTOR,

  // Token limits
  DEFAULT_MAX_TOKENS: LLM_TOKENS.DEFAULT_MAX,
  MAX_MAX_TOKENS: LLM_TOKENS.MAX_MAX,

  // Temperature range
  MIN_TEMPERATURE: LLM_TEMPERATURE.MIN,
  MAX_TEMPERATURE: LLM_TEMPERATURE.MAX,
  DEFAULT_TEMPERATURE: LLM_TEMPERATURE.DEFAULT,

  // Multipart handling
  MAX_MULTIPART_IMAGES: LLM_MULTIPART.MAX_IMAGES,
  MAX_IMAGE_SIZE_MB: LLM_MULTIPART.MAX_SIZE_MB,
  SUPPORTED_IMAGE_TYPES: LLM_MULTIPART.SUPPORTED_IMAGES,
  SUPPORTED_PDF_TYPES: LLM_MULTIPART.SUPPORTED_PDFS,
} as const

export type LLMConstants = typeof LLM_CONSTANTS
export type LLMDefaults = typeof LLM_DEFAULTS
