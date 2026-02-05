/**
 * Genkit Instance Manager
 * Singleton Genkit instance with lazy plugin loading per provider type
 *
 * @fileType implementation
 * @domain ai
 * @pattern singleton, genkit, lazy-loading
 */
import { getSecret, isConfigLoaded } from '@/infra/config/runtime/runtime-config'
import { logger } from '@/infra/utils/logger'
import { googleAI } from '@genkit-ai/googleai'
import type { Genkit } from 'genkit'
import { genkit } from 'genkit'
import { openAI } from 'genkitx-openai'
import type { Payload } from 'payload'
import { LLMProviderType } from '../providers/types'

/**
 * Genkit instance cache per provider type
 * One instance per provider type (gemini | openai-compatible)
 */
const instances = new Map<LLMProviderType, Genkit>()

/**
 * Get or create Genkit instance for the configured provider
 *
 * @param payload - Payload instance for config access
 * @param tenantId - Optional tenant ID for scoped configuration
 * @returns Configured Genkit instance
 */
export async function getGenkitInstance(payload: Payload, tenantId?: string): Promise<Genkit> {
  // Import dynamically to avoid circular dependency
  const { getProviderTypeFromEnv } = await import('../providers/factory')
  const providerType = await getProviderTypeFromEnv(payload)

  // Return cached instance if available
  if (instances.has(providerType)) {
    logger.debug({ providerType }, '[GenkitInstance] Returning cached Genkit instance')
    return instances.get(providerType)!
  }

  logger.info({ providerType, tenantId }, '[GenkitInstance] Creating new Genkit instance')

  // Get API key from ConfigSecrets (tenant-scoped)
  const apiKey = await getApiKeyForProvider(providerType, payload, tenantId)

  // Get base URL for OpenAI-compatible (tenant-scoped via ConfigSecrets)
  const baseURL = await getBaseUrlForProvider(providerType, payload, tenantId)

  // Configure plugins based on provider type
  const plugins = configurePlugins(providerType, apiKey, baseURL)

  // Create Genkit instance
  const instance = genkit({
    plugins,
  })

  // Cache the instance
  instances.set(providerType, instance)

  logger.info({ providerType }, '[GenkitInstance] Genkit instance created successfully')

  return instance
}

/**
 * Clear cached Genkit instances
 * Useful for testing or configuration changes
 */
export function clearGenkitCache(): void {
  instances.clear()
  logger.info('[GenkitInstance] Genkit instance cache cleared')
}

/**
 * Get API key for the specified provider
 */
async function getApiKeyForProvider(
  providerType: LLMProviderType,
  payload: Payload,
  tenantId?: string,
): Promise<string> {
  const secretKey =
    providerType === LLMProviderType.GEMINI ? 'GEMINI_API_KEY' : 'OPENAI_COMPATIBLE_API_KEY'

  // Check if config is loaded
  if (!isConfigLoaded()) {
    // Load runtime config if not already loaded
    const { loadRuntimeConfig } = await import('@/infra/config/runtime/runtime-config')
    await loadRuntimeConfig(payload)
  }

  // Try to get from ConfigSecrets first
  try {
    const secret = getSecret(secretKey, { tenantId, throwIfNotFound: false })
    if (secret) {
      return secret
    }
  } catch {
    // ConfigSecrets not available, continue to environment fallback
  }

  // Fallback to environment variable
  const envKey =
    providerType === LLMProviderType.GEMINI ? 'GEMINI_API_KEY' : 'OPENAI_COMPATIBLE_API_KEY'
  const envValue = process.env[envKey]

  if (!envValue) {
    logger.warn(
      { providerType, secretKey },
      '[GenkitInstance] API key not found in ConfigSecrets or environment',
    )
  }

  return envValue || ''
}

/**
 * Get base URL for OpenAI-compatible provider
 */
async function getBaseUrlForProvider(
  providerType: LLMProviderType,
  payload: Payload,
  tenantId?: string,
): Promise<string | undefined> {
  if (providerType !== LLMProviderType.OPENAI_COMPATIBLE) {
    return undefined
  }

  // Check if config is loaded
  if (!isConfigLoaded()) {
    const { loadRuntimeConfig } = await import('@/infra/config/runtime/runtime-config')
    await loadRuntimeConfig(payload)
  }

  // Try to get from ConfigSecrets first
  try {
    const baseUrl = getSecret('OPENAI_COMPATIBLE_BASE_URL', {
      tenantId,
      throwIfNotFound: false,
    })
    if (baseUrl) {
      return baseUrl
    }
  } catch {
    // ConfigSecrets not available, continue to environment fallback
  }

  // Fallback to environment variable
  return process.env.OPENAI_COMPATIBLE_BASE_URL
}

/**
 * Configure Genkit plugins based on provider type
 */
function configurePlugins(
  providerType: LLMProviderType,
  apiKey: string,
  baseURL?: string,
): Parameters<typeof genkit>[0]['plugins'] {
  const plugins: Parameters<typeof genkit>[0]['plugins'] = []

  switch (providerType) {
    case LLMProviderType.GEMINI:
      if (apiKey) {
        plugins.push(
          googleAI({
            apiKey,
          }),
        )
        logger.debug('[GenkitInstance] Configured Google AI plugin')
      } else {
        logger.warn('[GenkitInstance] No API key for Google AI - plugin may fail')
      }
      break

    case LLMProviderType.OPENAI_COMPATIBLE:
      if (apiKey) {
        plugins.push(
          openAI({
            apiKey,
            baseURL,
          }),
        )
        logger.debug({ baseURL }, '[GenkitInstance] Configured OpenAI-compatible plugin')
      } else {
        logger.warn('[GenkitInstance] No API key for OpenAI-compatible - plugin may fail')
      }
      break

    default:
      logger.warn({ providerType }, '[GenkitInstance] Unknown provider type, no plugins configured')
  }

  return plugins
}

/**
 * Check if a Genkit instance is available for the provider
 */
export async function isGenkitAvailable(
  payload: Payload,
  providerType?: LLMProviderType,
): Promise<boolean> {
  const resolvedProviderType =
    providerType || (await (await import('../providers/factory')).getProviderTypeFromEnv(payload))

  try {
    await getGenkitInstance(payload)
    return instances.has(resolvedProviderType)
  } catch {
    return false
  }
}
