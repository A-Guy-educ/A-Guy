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
import { getSystemParam, isConfigLoaded, loadRuntimeConfig } from '@/infra/config/runtime'
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
    console.log(`[LLMFactory] LLM_PROVIDER from process.env: ${envValue}`)
    if (envValue === 'openai-compatible') {
      return LLMProviderType.OPENAI_COMPATIBLE
    }
    return LLMProviderType.GEMINI
  }

  // Then check runtime config (Config_entries)
  if (payload) {
    try {
      let defaultTenantId: string | undefined
      if (!isConfigLoaded()) {
        defaultTenantId = await getDefaultTenantId(payload)
        console.log(`[LLMFactory] Loading runtime config for tenant: ${defaultTenantId}`)
        await loadRuntimeConfig(payload, defaultTenantId)
      } else {
        defaultTenantId = await getDefaultTenantId(payload)
      }
      console.log(
        `[LLMFactory] Config loaded, looking up LLM_PROVIDER for tenant: ${defaultTenantId}`,
      )
      const configValue = getSystemParam('LLM_PROVIDER', {
        tenantId: defaultTenantId,
        throwIfNotFound: false,
      })
      console.log(`[LLMFactory] getSystemParam result: "${configValue}"`)
      console.log(`[LLMFactory] getSystemParam result type: ${typeof configValue}`)
      console.log(`[LLMFactory] getSystemParam result length: ${configValue?.length}`)
      if (configValue) {
        const normalizedValue = configValue.toLowerCase()
        console.log(`[LLMFactory] LLM_PROVIDER from runtime config: ${normalizedValue}`)
        if (normalizedValue === 'openai-compatible') {
          return LLMProviderType.OPENAI_COMPATIBLE
        }
        return LLMProviderType.GEMINI
      }
    } catch (error) {
      console.log(`[LLMFactory] Error reading LLM_PROVIDER from config: ${error}`)
      // Config not loaded, continue with default
    }
  }

  // Default to gemini
  console.log('[LLMFactory] LLM_PROVIDER not configured, defaulting to gemini')
  return LLMProviderType.GEMINI
}

/**
 * Get provider type for a given config (uses env var or runtime config if not explicitly set)
 */
async function resolveProviderType(
  config?: Partial<LLMProviderConfig>,
  payload?: Payload,
): Promise<LLMProviderType> {
  if (config?.type) {
    return config.type
  }
  return getProviderTypeFromEnv(payload)
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
 * Respects LLM_PROVIDER (env var or runtime config) if type is not explicitly provided
 */
export async function getLLMProvider(
  payload: Payload,
  config?: Partial<LLMProviderConfig>,
): Promise<UnifiedLLMProvider> {
  const providerType = await resolveProviderType(config, payload)
  console.log(`[LLMFactory] Using provider type: ${providerType}`)

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
 * Auto-detect the best available provider (respects LLM_PROVIDER preference from env or config)
 */
export async function detectBestProvider(payload: Payload): Promise<LLMProviderType> {
  // First check if user specified a preference via env var or runtime config
  const envProvider = await getProviderTypeFromEnv(payload)
  console.log(`[LLMFactory] detectBestProvider - preferred provider: ${envProvider}`)

  // Check if the preferred provider is available
  const availability = await checkProviderAvailability(payload)
  console.log(`[LLMFactory] detectBestProvider - availability:`, availability)

  if (envProvider === LLMProviderType.OPENAI_COMPATIBLE && availability['openai-compatible']) {
    console.log(
      '[LLMFactory] detectBestProvider - using OPENAI_COMPATIBLE (preferred and available)',
    )
    return LLMProviderType.OPENAI_COMPATIBLE
  }

  if (envProvider === LLMProviderType.OPENAI_COMPATIBLE && !availability['openai-compatible']) {
    console.log(
      '[LLMFactory] detectBestProvider - OPENAI_COMPATIBLE preferred but NOT available, falling back',
    )
  }

  if (envProvider === LLMProviderType.GEMINI && availability.gemini) {
    return LLMProviderType.GEMINI
  }

  // Fallback: prefer available provider
  if (availability['openai-compatible']) {
    console.log('[LLMFactory] detectBestProvider - fallback: using OPENAI_COMPATIBLE (available)')
    return LLMProviderType.OPENAI_COMPATIBLE
  }
  if (availability.gemini) {
    return LLMProviderType.GEMINI
  }

  // Default to gemini if none configured
  console.log('[LLMFactory] detectBestProvider - no providers available, defaulting to GEMINI')
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
