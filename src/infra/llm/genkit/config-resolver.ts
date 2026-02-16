/**
 * Config Resolver
 * Maps ConfigValues to Genkit model configuration
 *
 * @fileType implementation
 * @domain ai
 * @pattern config-mapping, genkit
 *
 * Configuration hierarchy (highest → lowest):
 * 1. LLM_MODEL_OVERRIDE_* env vars
 * 2. ConfigValues/chat domain
 * 3. MODEL_REGISTRY defaults
 */
import { getConfigDomain } from '@/infra/config/runtime/config-values'
import type { Payload } from 'payload'
import type { AIModelKey } from '../models'
import { MODEL_REGISTRY, PROVIDER_MODEL_NAMES, getModelNameOverride } from '../models'
import type { LLMProviderType } from '../providers/types'

/**
 * Genkit model configuration
 */
export interface GenkitModelConfig {
  /** Full model reference (e.g., 'googleai/gemini-2.0-flash-001') */
  model: string
  /** Generation temperature (0.0 - 2.0) */
  temperature: number
  /** Maximum output tokens */
  maxOutputTokens: number
  /** Timeout in seconds (optional) */
  timeout?: number
}

/**
 * Chat configuration interface from ConfigValues
 */
interface ChatConfig {
  temperature: { default: number }
  chatSettings: { defaultChatTimeoutMs: number }
  models: {
    exerciseChat: { gemini: string; openaiCompatible: string; maxOutputTokens: number }
    imageToExercise: { gemini: string; openaiCompatible: string; maxOutputTokens: number }
    pdfToExercise: { gemini: string; openaiCompatible: string; maxOutputTokens: number }
    answerValidation: { gemini: string; openaiCompatible: string; maxOutputTokens: number }
    interactiveRemediation: { gemini: string; openaiCompatible: string; maxOutputTokens: number }
  }
}

/**
 * Resolve Genkit configuration for a specific model key and tenant
 */
export async function resolveGenkitConfig(
  modelKey: AIModelKey,
  tenantId?: string,
  payload?: Payload,
): Promise<GenkitModelConfig> {
  // 1. Check for runtime model name override from environment
  const overrideName = getModelNameOverride(modelKey)
  if (overrideName) {
    const registryEntry = MODEL_REGISTRY[modelKey]
    return {
      model: overrideName,
      temperature: registryEntry.temperature,
      maxOutputTokens: registryEntry.maxOutputTokens,
    }
  }

  // 2. Determine provider type
  // Import dynamically to avoid circular dependency
  const { getProviderTypeFromEnv } = await import('../providers/factory')
  const providerType = await getProviderTypeFromEnv(payload)

  // 3. Get provider-specific model name from ConfigValues or defaults
  let modelName: string
  let maxOutputTokens: number
  let temperature: number
  let timeout: number | undefined

  try {
    // Load chat configuration from ConfigValues
    const chatConfig = await getChatConfig(tenantId)
    const modelSettings = chatConfig.models[mapModelKeyToConfigKey(modelKey)]

    modelName = providerType === 'gemini' ? modelSettings.gemini : modelSettings.openaiCompatible
    maxOutputTokens = modelSettings.maxOutputTokens
    temperature = chatConfig.temperature.default
    timeout = Math.floor(chatConfig.chatSettings.defaultChatTimeoutMs / 1000)
  } catch {
    // Fallback to MODEL_REGISTRY defaults if ConfigValues not available
    const registryEntry = MODEL_REGISTRY[modelKey]
    const providerModelNames = PROVIDER_MODEL_NAMES[providerType as LLMProviderType]

    modelName = providerModelNames[modelKey]
    maxOutputTokens = registryEntry.maxOutputTokens
    temperature = registryEntry.temperature
  }

  // 4. Prefix model name with provider namespace for Genkit
  const genkitModel = prefixModelWithProvider(modelName, providerType)

  return {
    model: genkitModel,
    temperature,
    maxOutputTokens,
    timeout,
  }
}

/**
 * Get chat configuration from ConfigValues
 */
async function getChatConfig(tenantId?: string): Promise<ChatConfig> {
  return (await getConfigDomain('chat', {
    tenantId,
    throwIfNotFound: false,
  })) as unknown as ChatConfig
}

/**
 * Map AIModelKey to ConfigValues model key
 */
function mapModelKeyToConfigKey(modelKey: AIModelKey): keyof ChatConfig['models'] {
  const mapping: Record<AIModelKey, keyof ChatConfig['models']> = {
    IMAGE_TO_EXERCISE: 'imageToExercise',
    EXERCISE_CHAT: 'exerciseChat',
    PDF_TO_EXERCISE: 'pdfToExercise',
    ANSWER_VALIDATION: 'answerValidation',
    INTERACTIVE_REMEDIATION: 'interactiveRemediation',
  }
  return mapping[modelKey]
}

/**
 * Prefix model name with provider namespace for Genkit
 */
function prefixModelWithProvider(modelName: string, providerType: string): string {
  if (providerType === 'gemini') {
    return `googleai/${modelName}`
  }
  return `openai/${modelName}`
}

/**
 * Get model name without provider prefix (for display/logging)
 */
export function getDisplayModelName(genkitModel: string): string {
  return genkitModel.includes('/') ? genkitModel.split('/')[1] : genkitModel
}
