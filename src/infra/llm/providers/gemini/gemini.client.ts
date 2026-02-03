/**
 * Gemini Client Module
 * Handles SDK initialization, singleton caching, and environment config
 *
 * @internal This module is used by gemini.provider.ts only
 */
import { getSecret, isConfigLoaded, loadRuntimeConfig } from '@/infra/config/runtime'
// Note: getSecret keeps its old signature for secrets (tenantId, key, options)
// These are API keys and should remain secrets
import { logger } from '@/infra/utils/logger'
import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Payload } from 'payload'

let geminiClient: GoogleGenerativeAI | null = null

/**
 * Ensure runtime config is loaded for default tenant
 */
async function ensureConfigLoaded(payload: Payload): Promise<void> {
  if (!isConfigLoaded()) {
    // Load config for the default tenant (system-wide config)
    const defaultTenantId = await getDefaultTenantId(payload)
    await loadRuntimeConfig(payload, defaultTenantId)
  }
}

/**
 * Check if Gemini API key is configured via runtime config
 */
export async function isGeminiApiKeyConfigured(payload: Payload): Promise<boolean> {
  try {
    // Ensure config is loaded
    await ensureConfigLoaded(payload)

    // First check process.env for direct override
    if (process.env.GEMINI_API_KEY) {
      return true
    }

    // Then check runtime config using default tenant
    const defaultTenantId = await getDefaultTenantId(payload)
    const apiKey = getSecret('GEMINI_API_KEY', {
      tenantId: defaultTenantId,
      throwIfNotFound: false,
    })
    return !!apiKey
  } catch {
    return false
  }
}

/**
 * Get or create Gemini client singleton
 * @param payload - Payload instance for runtime config access
 * @throws GeminiConfigError if API key not configured
 */
export async function getGeminiClient(payload: Payload): Promise<GoogleGenerativeAI> {
  if (!geminiClient) {
    // Ensure config is loaded
    await ensureConfigLoaded(payload)

    // First check process.env for direct override
    let apiKey = process.env.GEMINI_API_KEY

    // Then check runtime config using default tenant
    if (!apiKey) {
      const defaultTenantId = await getDefaultTenantId(payload)
      apiKey = getSecret('GEMINI_API_KEY', { tenantId: defaultTenantId, throwIfNotFound: false })
    }

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.')
    }

    // Log API key source (masked for security)
    const keySource = process.env.GEMINI_API_KEY ? 'process.env' : 'runtime config'
    const keyPrefix = apiKey.substring(0, 7)
    const keySuffix = apiKey.substring(apiKey.length - 4)
    logger.debug({ keySource, keyPrefix, keySuffix }, '[GeminiClient] Initializing')

    geminiClient = new GoogleGenerativeAI(apiKey)
  }
  return geminiClient
}

/**
 * Reset client singleton (for testing)
 * @internal
 */
export function resetGeminiClient(): void {
  geminiClient = null
}
