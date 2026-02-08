/**
 * LLM Provider Factory
 * Unified interface for switching between LLM providers at runtime
 *
 * @fileType factory
 * @domain ai
 * @pattern provider-factory, abstraction, dependency-injection
 *
 * Uses centralized MODEL_REGISTRY and PROVIDER_MODEL_NAMES from @/infra/llm/models.ts
 * for model configurations. This ensures a single source of truth for all model definitions.
 */
import {
  getConfigValueByKey,
  isConfigValuesLoaded,
  loadConfigValues,
} from '@/infra/config/runtime/config-values'
import { logger } from '@/infra/utils/logger'
import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'
import type { Payload } from 'payload'
import { LLMProviderType } from './types'
export { LLMProviderType }

import {
  MODEL_REGISTRY,
  PROVIDER_MODEL_NAMES,
  getModelNameOverride,
  type AIModel,
  type AIModelKey,
} from '../models'

// Configuration
export interface LLMProviderConfig {
  type: LLMProviderType
  modelKey?: AIModelKey // Uses centralized AI_MODELS keys
}

// Default model key
const DEFAULT_MODEL_KEY: AIModelKey = 'EXERCISE_CHAT'

/**
 * Resolve provider type from LLM_PROVIDER (env var or runtime config)
 * Supports: 'gemini', 'openai-compatible'
 */
export async function getProviderTypeFromEnv(payload?: Payload): Promise<LLMProviderType> {
  // First check process.env for direct override
  const envValue = process.env.LLM_PROVIDER?.toLowerCase()
  if (envValue) {
    logger.debug({ envValue }, '[LLMFactory] LLM_PROVIDER from process.env')
    if (envValue === 'openai-compatible') {
      return LLMProviderType.OPENAI_COMPATIBLE
    }
    return LLMProviderType.GEMINI
  }

  // Then check runtime config (ConfigValues)
  if (payload) {
    try {
      let defaultTenantId: string | undefined
      if (!isConfigValuesLoaded()) {
        defaultTenantId = await getDefaultTenantId(payload)
        logger.debug({ tenantId: defaultTenantId }, '[LLMFactory] Loading config values')
        await loadConfigValues(payload, defaultTenantId)
      } else {
        defaultTenantId = await getDefaultTenantId(payload)
      }
      logger.debug(
        { tenantId: defaultTenantId },
        '[LLMFactory] Config loaded, looking up LLM_PROVIDER',
      )
      const configValue = await getConfigValueByKey<string | undefined>('global', 'LLM_PROVIDER', {
        tenantId: defaultTenantId,
        throwIfNotFound: false,
      })
      logger.debug({ configValue }, '[LLMFactory] getConfigValueByKey result')
      if (configValue) {
        const normalizedValue = configValue.toLowerCase()
        logger.debug(
          { configValue: normalizedValue },
          '[LLMFactory] LLM_PROVIDER from runtime config',
        )
        if (normalizedValue === 'openai-compatible') {
          return LLMProviderType.OPENAI_COMPATIBLE
        }
        return LLMProviderType.GEMINI
      }
    } catch (error) {
      logger.error({ err: error }, '[LLMFactory] Error reading LLM_PROVIDER from config')
      // Config not loaded, continue with default
    }
  }

  // Default to gemini
  logger.debug('[LLMFactory] LLM_PROVIDER not configured, defaulting to gemini')
  return LLMProviderType.GEMINI
}

/**
 * Get provider type for a given config (uses env var or runtime config if not explicitly set)
 */
async function _resolveProviderType(
  _config?: Partial<LLMProviderConfig>,
  _payload?: Payload,
): Promise<LLMProviderType> {
  // This function is kept for interface compatibility but always returns GEMINI
  // since Genkit uses Google AI plugin by default
  return LLMProviderType.GEMINI
}

/**
 * Get custom base URL for openai-compatible provider
 * ONLY uses OPENAI_COMPATIBLE_BASE_URL - no fallback to OPENAI_BASE_URL
 */
export function getOpenAICompatibleBaseUrl(): string | undefined {
  return process.env.OPENAI_COMPATIBLE_BASE_URL
}

/**
 * Get API key for openai-compatible provider
 * ONLY uses OPENAI_COMPATIBLE_API_KEY - no fallback to OPENAI_API_KEY
 */
export function getOpenAICompatibleApiKey(): string | undefined {
  return process.env.OPENAI_COMPATIBLE_API_KEY
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

  // Streaming chat (optional - falls back to generateChatCompletion if not implemented)
  generateStreamingChatCompletion?: (
    input: {
      system: string
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
      model: { name: string; temperature: number; maxOutputTokens: number }
      acknowledgment: string
      timeoutMs?: number
    },
    payload: Payload,
  ) => Promise<{
    stream: AsyncIterable<{ text: string }>
    response: Promise<{ text: string }>
  }>

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
 * Uses centralized MODEL_REGISTRY (temperature, maxOutputTokens) and provider-specific model names
 * Supports runtime overrides via LLM_MODEL_OVERRIDE_* environment variables
 */
export function getProviderModelConfig(
  providerType: LLMProviderType,
  modelKey: AIModelKey = DEFAULT_MODEL_KEY,
): AIModel {
  // Check for runtime model name override first
  const overrideName = getModelNameOverride(modelKey)
  const modelName = overrideName ?? PROVIDER_MODEL_NAMES[providerType][modelKey]

  return {
    name: modelName,
    ...MODEL_REGISTRY[modelKey],
  }
}

/**
 * Get the active LLM provider based on configuration
 * Delegates to Genkit adapter for unified LLM operations.
 */
export async function getLLMProvider(
  payload: Payload,
  _config?: Partial<LLMProviderConfig>,
): Promise<UnifiedLLMProvider> {
  logger.info('[LLMFactory] Using Genkit backend')
  const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
  return createGenkitUnifiedAdapter(payload)
}

/**
 * Check if providers are available (Genkit-based)
 */
export async function checkProviderAvailability(payload: Payload): Promise<{
  gemini: boolean
  'openai-compatible': boolean
}> {
  const { isGenkitConfigured } = await import('../genkit/adapters/unified-adapter')
  const configured = await isGenkitConfigured(payload)
  return { gemini: configured, 'openai-compatible': configured }
}

/**
 * Auto-detect the best available provider
 * Always returns GEMINI as Genkit uses Google AI plugin by default
 */
export async function detectBestProvider(_payload: Payload): Promise<LLMProviderType> {
  return LLMProviderType.GEMINI
}
