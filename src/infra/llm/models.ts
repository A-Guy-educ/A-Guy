/**
 * LLM Model Registry - Single Source of Truth for All Model Definitions
 *
 * This module centralizes all model configurations to eliminate duplication
 * and enable proper provider switching at runtime.
 *
 * Architecture:
 * - MODEL_REGISTRY: Provider-agnostic configs (temperature, maxTokens, capabilities)
 * - PROVIDER_MODEL_NAMES: Provider-specific model name mappings
 * - AI_MODELS: Convenience export for backward compatibility (Gemini defaults)
 *
 * Usage:
 * ```typescript
 * import { MODEL_REGISTRY, PROVIDER_MODEL_NAMES, AI_MODELS, getProviderModelConfig } from '@/infra/llm/models'
 * import { LLMProviderType } from '@/infra/llm/providers/factory'
 *
 * // Get model config for specific provider
 * const config = getProviderModelConfig(LLMProviderType.GEMINI, 'EXERCISE_CHAT')
 *
 * // Access raw registry for custom logic
 * const registry = MODEL_REGISTRY.EXERCISE_CHAT
 * ```
 *
 * Runtime Model Overrides:
 * Set LLM_MODEL_OVERRIDE_<MODEL_KEY> environment variables to override models:
 * - LLM_MODEL_OVERRIDE_EXERCISE_CHAT=gemini-1.5-pro
 * - LLM_MODEL_OVERRIDE_DEFAULT=gpt-4o
 */

import { LLMProviderType } from './providers/types'

// ─────────────────────────────────────────────────────────────────────────────
// Shared Types (consolidated from providers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unified AI Model configuration
 * Used across all providers for consistent model representation
 */
export interface AIModel {
  /** Provider-specific model name (e.g., 'gemini-2.0-flash-001', 'MiniMax-M2.1') */
  name: string
  /** Generation temperature (0.0 - 2.0, lower = more deterministic) */
  temperature: number
  /** Maximum number of output tokens */
  maxOutputTokens: number
  /** Optional capability tags for feature detection */
  capabilities?: string[]
}

/**
 * Union type of all valid model keys
 * Add new models here to extend the registry
 */
export type AIModelKey =
  | 'IMAGE_TO_EXERCISE'
  | 'EXERCISE_CHAT'
  | 'PDF_TO_EXERCISE'
  | 'ANSWER_VALIDATION'
  | 'SUPPORT_GENERATION'

// ─────────────────────────────────────────────────────────────────────────────
// Model Registry - Single Source of Truth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provider-agnostic model configurations
 * Defines temperature, maxTokens, and capabilities for each task
 *
 * To add a new model:
 * 1. Add key to AIModelKey type
 * 2. Add entry to MODEL_REGISTRY
 * 3. Add entries to PROVIDER_MODEL_NAMES for each provider
 * 4. Optionally add to AI_MODELS for backward compatibility
 */
export const MODEL_REGISTRY: Record<AIModelKey, Omit<AIModel, 'name'>> = {
  IMAGE_TO_EXERCISE: {
    temperature: 0.2,
    maxOutputTokens: 8192,
    capabilities: ['multimodal', 'vision'],
  },
  EXERCISE_CHAT: {
    temperature: 0.7,
    maxOutputTokens: 2048,
    capabilities: ['multimodal', 'chat'],
  },
  PDF_TO_EXERCISE: {
    temperature: 0.1,
    maxOutputTokens: 8192,
    capabilities: ['document', 'extraction'],
  },
  ANSWER_VALIDATION: {
    temperature: 0.2,
    maxOutputTokens: 512,
    capabilities: ['chat', 'validation'],
  },
  SUPPORT_GENERATION: {
    temperature: 0.5,
    maxOutputTokens: 4096,
    capabilities: ['chat', 'generation'],
  },
} as const

/**
 * Provider-specific model name mappings
 * Maps each AIModelKey to the actual model name for each provider
 *
 * This is the ONLY place where provider-specific model names are defined,
 * eliminating duplication between models.ts and factory.ts
 */
export const PROVIDER_MODEL_NAMES: Record<LLMProviderType, Record<AIModelKey, string>> = {
  [LLMProviderType.GEMINI]: {
    IMAGE_TO_EXERCISE: 'gemini-3.1-pro',
    EXERCISE_CHAT: 'gemini-3.1-flash-lite-preview',
    PDF_TO_EXERCISE: 'gemini-3.1-pro',
    ANSWER_VALIDATION: 'gemini-3.1-pro',
    SUPPORT_GENERATION: 'gemini-3.1-pro',
  },
  [LLMProviderType.OPENAI_COMPATIBLE]: {
    IMAGE_TO_EXERCISE: 'MiniMax-M2.1',
    EXERCISE_CHAT: 'MiniMax-M2.1',
    PDF_TO_EXERCISE: 'MiniMax-M2.1',
    ANSWER_VALIDATION: 'MiniMax-M2.1',
    SUPPORT_GENERATION: 'MiniMax-M2.1',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Override Support
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get model name override from environment variables
 * Supports:
 * - LLM_MODEL_OVERRIDE_<MODEL_KEY> (e.g., LLM_MODEL_OVERRIDE_EXERCISE_CHAT)
 * - LLM_MODEL_OVERRIDE_DEFAULT (fallback for all models)
 */
export function getModelNameOverride(modelKey: AIModelKey): string | undefined {
  // Check specific model override first
  const specificOverride = process.env[`LLM_MODEL_OVERRIDE_${modelKey}`]
  if (specificOverride) {
    return specificOverride
  }

  // Check default override
  return process.env.LLM_MODEL_OVERRIDE_DEFAULT
}

/**
 * Check if any model override is configured
 */
export function isModelOverrideConfigured(): boolean {
  return (
    Object.keys(process.env).some((key) => key.startsWith('LLM_MODEL_OVERRIDE_')) ||
    process.env.LLM_MODEL_OVERRIDE_DEFAULT !== undefined
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Exports (backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AI Models configuration - backward compatible export
 * Uses Gemini as the default provider for existing consumers
 *
 * @deprecated Use getProviderModelConfig() for provider-aware selection
 */
export const AI_MODELS: Record<AIModelKey, AIModel> = {
  IMAGE_TO_EXERCISE: {
    ...MODEL_REGISTRY.IMAGE_TO_EXERCISE,
    name: PROVIDER_MODEL_NAMES[LLMProviderType.GEMINI].IMAGE_TO_EXERCISE,
  },
  EXERCISE_CHAT: {
    ...MODEL_REGISTRY.EXERCISE_CHAT,
    name: PROVIDER_MODEL_NAMES[LLMProviderType.GEMINI].EXERCISE_CHAT,
  },
  PDF_TO_EXERCISE: {
    ...MODEL_REGISTRY.PDF_TO_EXERCISE,
    name: PROVIDER_MODEL_NAMES[LLMProviderType.GEMINI].PDF_TO_EXERCISE,
  },
  ANSWER_VALIDATION: {
    ...MODEL_REGISTRY.ANSWER_VALIDATION,
    name: PROVIDER_MODEL_NAMES[LLMProviderType.GEMINI].ANSWER_VALIDATION,
  },
  SUPPORT_GENERATION: {
    ...MODEL_REGISTRY.SUPPORT_GENERATION,
    name: PROVIDER_MODEL_NAMES[LLMProviderType.GEMINI].SUPPORT_GENERATION,
  },
} as const

/**
 * Type for AI_MODELS values - preserved for backward compatibility
 */
export type AIModelConfig = AIModel

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get model registry entry for a given key
 * Useful for accessing provider-agnostic config
 */
export function getModelRegistryEntry(modelKey: AIModelKey): Omit<AIModel, 'name'> {
  return MODEL_REGISTRY[modelKey]
}

/**
 * Get provider-specific model name for a given key and provider
 */
export function getProviderModelName(providerType: LLMProviderType, modelKey: AIModelKey): string {
  return PROVIDER_MODEL_NAMES[providerType][modelKey]
}

/**
 * Check if a model supports a specific capability
 */
export function modelSupportsCapability(modelKey: AIModelKey, capability: string): boolean {
  return MODEL_REGISTRY[modelKey].capabilities?.includes(capability) ?? false
}

/**
 * Get all model keys that support a specific capability
 */
export function getModelsWithCapability(capability: string): AIModelKey[] {
  return (Object.keys(MODEL_REGISTRY) as AIModelKey[]).filter((key) =>
    MODEL_REGISTRY[key].capabilities?.includes(capability),
  )
}
