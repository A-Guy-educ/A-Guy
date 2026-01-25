/**
 * Gemini Client Module
 * Handles SDK initialization, singleton caching, and environment config
 *
 * @internal This module is used by gemini.provider.ts only
 */
import { getSecret, isConfigLoaded, loadRuntimeConfig } from '@/lib/config/runtime'
import { getDefaultTenantId } from '@/lib/tenant/get-default-tenant'
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

    // Check runtime config using default tenant
    const defaultTenantId = await getDefaultTenantId(payload)
    const apiKey = getSecret(defaultTenantId, 'GEMINI_API_KEY', { throwIfNotFound: false })
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

    // Get API key from tenant-scoped secret storage
    const defaultTenantId = await getDefaultTenantId(payload)
    const apiKey = getSecret(defaultTenantId, 'GEMINI_API_KEY', { throwIfNotFound: false })

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in tenant config.')
    }
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
