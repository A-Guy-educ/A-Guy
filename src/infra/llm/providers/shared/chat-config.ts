/**
 * Chat Config
 * Loads configuration from ConfigValues (chat domain)
 */
import { ConfigDomain } from '@/infra/config/config-constants'
import { getConfigDomain } from '@/infra/config/runtime'

export interface ChatConfig {
  timeouts: { defaultMs: number; toolCallMs: number; streamingMs: number }
  retry: { maxRetries: number; delayMs: number; exponentialBase: number; jitterFactor: number }
  tokens: { defaultMax: number; maxMax: number }
  temperature: { min: number; max: number; default: number }
  multipart: {
    maxImages: number
    maxSizeMb: number
    supportedImages: string[]
    supportedPdfs: string[]
  }
  providerUrls: { geminiApiBase: string; openaiCompatibleApiBase: string }
  defaultModels: { gemini: string; openaiCompatible: string }
  chatSettings: {
    maxToolIterations: number
    defaultMaxRetries: number
    defaultRetryDelayMs: number
    defaultChatTimeoutMs: number
    defaultToolTimeoutMs: number
  }
  /** Model settings - replaces hardcoded MODEL_REGISTRY */
  models: {
    exerciseChat: {
      /** Provider-specific model name */
      gemini: string
      openaiCompatible: string
      /** Max output tokens for exercise chat */
      maxOutputTokens: number
      /** Capabilities for exercise chat */
      capabilities: string[]
    }
    imageToExercise: {
      gemini: string
      openaiCompatible: string
      maxOutputTokens: number
      capabilities: string[]
    }
    pdfToExercise: {
      gemini: string
      openaiCompatible: string
      maxOutputTokens: number
      capabilities: string[]
    }
  }
  /** Student chat quota settings */
  quota?: {
    maxQuestions: number
    windowHours: number
  }
}

export async function getChatConfig(): Promise<ChatConfig> {
  return (await getConfigDomain(ConfigDomain.Chat)) as unknown as ChatConfig
}

/**
 * Get model configuration for a specific provider and task
 * Replaces hardcoded MODEL_REGISTRY values with config-driven values
 */
export async function getModelConfig(
  provider: 'gemini' | 'openaiCompatible',
  task: 'exerciseChat' | 'imageToExercise' | 'pdfToExercise',
): Promise<{
  name: string
  temperature: number
  maxOutputTokens: number
  capabilities: string[]
}> {
  const config = await getChatConfig()
  const modelSettings = config.models[task]

  return {
    name: provider === 'gemini' ? modelSettings.gemini : modelSettings.openaiCompatible,
    temperature: config.temperature.default,
    maxOutputTokens: modelSettings.maxOutputTokens,
    capabilities: modelSettings.capabilities,
  }
}
