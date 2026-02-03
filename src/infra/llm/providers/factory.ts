/**
 * LLM Provider Factory
 * Unified interface for switching between LLM providers at runtime
 *
 * @fileType factory
 * @domain ai
 * @pattern provider-factory, abstraction, dependency-injection
 *
 * Uses centralized AI_MODELS from @/infra/llm/models.ts for model configurations.
 * Only defines provider-specific model name mappings (not temperature/maxTokens).
 */
import type { Payload } from 'payload'
import { AI_MODELS, type AIModelKey } from '../models'

// Provider types - matches LLM_PROVIDER env var values
export const LLMProviderType = {
  GEMINI: 'gemini',
  OPENAI_COMPATIBLE: 'openai-compatible',
} as const

export type LLMProviderType = (typeof LLMProviderType)[keyof typeof LLMProviderType]

// Provider-specific model name mappings (maps AI_MODELS keys to provider-specific model names)
// Temperature and maxOutputTokens come from centralized AI_MODELS
const PROVIDER_MODEL_MAP: Record<LLMProviderType, Record<AIModelKey, string>> = {
  [LLMProviderType.GEMINI]: {
    IMAGE_TO_EXERCISE: 'gemini-2.0-flash-001',
    EXERCISE_CHAT: 'gemini-2.0-flash-001',
    PDF_TO_EXERCISE: 'gemini-2.0-flash-001',
  },
  [LLMProviderType.OPENAI_COMPATIBLE]: {
    IMAGE_TO_EXERCISE: 'MiniMax-M2.1',
    EXERCISE_CHAT: 'MiniMax-M2.1',
    PDF_TO_EXERCISE: 'MiniMax-M2.1',
  },
}

// Configuration
export interface LLMProviderConfig {
  type: LLMProviderType
  modelKey?: AIModelKey // Uses centralized AI_MODELS keys
}

// Default model key
const DEFAULT_MODEL_KEY: AIModelKey = 'EXERCISE_CHAT'

/**
 * Resolve provider type from LLM_PROVIDER environment variable
 * Supports: 'gemini', 'openai-compatible'
 */
export function getProviderTypeFromEnv(): LLMProviderType {
  const envValue = process.env.LLM_PROVIDER?.toLowerCase()

  if (envValue === 'openai-compatible') {
    return LLMProviderType.OPENAI_COMPATIBLE
  }

  // Default to gemini for 'gemini' or any other value/missing
  return LLMProviderType.GEMINI
}

/**
 * Get provider type for a given config (uses env var if not explicitly set)
 */
function resolveProviderType(config?: Partial<LLMProviderConfig>): LLMProviderType {
  if (config?.type) {
    return config.type
  }
  return getProviderTypeFromEnv()
}

/**
 * Get custom base URL for openai-compatible provider
 */
export function getOpenAICompatibleBaseUrl(): string | undefined {
  return process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL
}

/**
 * Get API key for openai-compatible provider
 */
export function getOpenAICompatibleApiKey(): string | undefined {
  return process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY
}

// Unified provider interface
export interface UnifiedLLMProvider {
  // Basic chat
  generateChatCompletion: (
    input: {
      system: string
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
      model: { name: string; temperature: number; maxOutputTokens: number }
      acknowledgment: string
      timeoutMs?: number
    },
    payload: Payload,
  ) => Promise<{ text: string; raw?: unknown }>

  // Multimodal
  generateMultimodalCompletion: (
    input: {
      prompt: string
      model: { name: string; temperature: number; maxOutputTokens: number }
      attachments: Array<{ data: string; mimeType: string }>
      timeoutMs?: number
    },
    payload: Payload,
  ) => Promise<{ text: string; raw?: unknown }>

  // Tool calling
  generateChatCompletionWithTools: (
    input: {
      system: string
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
      model: { name: string; temperature: number; maxOutputTokens: number }
      acknowledgment: string
      tools: Array<{
        name: string
        description?: string
        inputSchema?: Record<string, unknown>
      }>
      toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>
      timeoutMs?: number
    },
    payload: Payload,
  ) => Promise<{
    text: string
    raw?: unknown
    toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
  }>

  // Config check
  isConfigured: (payload: Payload) => Promise<boolean>

  // Error code constants
  errorCodes: Record<string, string>
}

/**
 * Get model config for a specific provider and task
 * Uses centralized AI_MODELS (temperature, maxOutputTokens) and provider-specific model names
 */
export function getProviderModelConfig(
  providerType: LLMProviderType,
  modelKey: AIModelKey = DEFAULT_MODEL_KEY,
): { name: string; temperature: number; maxOutputTokens: number } {
  const baseConfig = AI_MODELS[modelKey]
  const providerModelName = PROVIDER_MODEL_MAP[providerType][modelKey]

  return {
    name: providerModelName,
    temperature: baseConfig.temperature,
    maxOutputTokens: baseConfig.maxOutputTokens,
  }
}

/**
 * Get the active LLM provider based on configuration
 * Respects LLM_PROVIDER env var if type is not explicitly provided
 */
export async function getLLMProvider(
  payload: Payload,
  config?: Partial<LLMProviderConfig>,
): Promise<UnifiedLLMProvider> {
  const providerType = resolveProviderType(config)

  switch (providerType) {
    case LLMProviderType.OPENAI_COMPATIBLE: {
      const mod = await import('./openai')
      return createOpenAIProvider(mod)
    }
    case LLMProviderType.GEMINI:
    default: {
      const mod = await import('./gemini')
      return createGeminiProvider(mod)
    }
  }
}

/**
 * Check which providers are available
 */
export async function checkProviderAvailability(payload: Payload): Promise<{
  gemini: boolean
  'openai-compatible': boolean
}> {
  const { isGeminiApiKeyConfigured } = await import('./gemini')
  const { isOpenAIApiKeyConfigured } = await import('./openai')

  const [gemini, openaiCompatible] = await Promise.all([
    isGeminiApiKeyConfigured(payload),
    isOpenAIApiKeyConfigured(payload),
  ])

  return { gemini, 'openai-compatible': openaiCompatible }
}

/**
 * Auto-detect the best available provider (respects LLM_PROVIDER env var preference)
 */
export async function detectBestProvider(payload: Payload): Promise<LLMProviderType> {
  // First check if user specified a preference via env var
  const envProvider = getProviderTypeFromEnv()

  // Check if the preferred provider is available
  const availability = await checkProviderAvailability(payload)

  if (envProvider === LLMProviderType.OPENAI_COMPATIBLE && availability['openai-compatible']) {
    return LLMProviderType.OPENAI_COMPATIBLE
  }

  if (envProvider === LLMProviderType.GEMINI && availability.gemini) {
    return LLMProviderType.GEMINI
  }

  // Fallback: prefer available provider
  if (availability['openai-compatible']) {
    return LLMProviderType.OPENAI_COMPATIBLE
  }
  if (availability.gemini) {
    return LLMProviderType.GEMINI
  }

  // Default to gemini if none configured
  return LLMProviderType.GEMINI
}

// Adapter to unify Gemini's interface
function createGeminiProvider(mod: {
  generateChatCompletion: UnifiedLLMProvider['generateChatCompletion']
  generateMultimodalCompletion: UnifiedLLMProvider['generateMultimodalCompletion']
  generateChatCompletionWithTools: UnifiedLLMProvider['generateChatCompletionWithTools']
  isGeminiApiKeyConfigured: (payload: Payload) => Promise<boolean>
  GeminiErrorCode: Record<string, string>
}): UnifiedLLMProvider {
  return {
    generateChatCompletion: mod.generateChatCompletion,
    generateMultimodalCompletion: mod.generateMultimodalCompletion,
    generateChatCompletionWithTools: mod.generateChatCompletionWithTools,
    isConfigured: mod.isGeminiApiKeyConfigured,
    errorCodes: mod.GeminiErrorCode,
  }
}

// Adapter to unify OpenAI-compatible's interface
function createOpenAIProvider(mod: {
  generateChatCompletion: UnifiedLLMProvider['generateChatCompletion']
  generateMultimodalCompletion: UnifiedLLMProvider['generateMultimodalCompletion']
  generateChatCompletionWithTools: UnifiedLLMProvider['generateChatCompletionWithTools']
  isOpenAIApiKeyConfigured: (payload: Payload) => Promise<boolean>
  OpenAIErrorCode: Record<string, string>
}): UnifiedLLMProvider {
  return {
    generateChatCompletion: mod.generateChatCompletion,
    generateMultimodalCompletion: mod.generateMultimodalCompletion,
    generateChatCompletionWithTools: mod.generateChatCompletionWithTools,
    isConfigured: mod.isOpenAIApiKeyConfigured,
    errorCodes: mod.OpenAIErrorCode,
  }
}
