/**
 * OpenAI-Compatible Provider - Client Module
 * Handles SDK initialization, singleton caching, and environment config
 *
 * @internal This module is used by openai.provider.ts only
 */
import { getSecret, isConfigLoaded, loadRuntimeConfig } from '@/infra/config/runtime'
import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'
import OpenAI from 'openai'
import type { Payload } from 'payload'

let openaiClient: OpenAI | null = null

/**
 * Ensure runtime config is loaded for default tenant
 */
async function ensureConfigLoaded(payload: Payload): Promise<void> {
  if (!isConfigLoaded()) {
    const defaultTenantId = await getDefaultTenantId(payload)
    await loadRuntimeConfig(payload, defaultTenantId)
  }
}

/**
 * Check if OpenAI-compatible API key is configured via runtime config
 * Checks OPENAI_COMPATIBLE_API_KEY first, then falls back to OPENAI_API_KEY
 */
export async function isOpenAIApiKeyConfigured(payload: Payload): Promise<boolean> {
  try {
    await ensureConfigLoaded(payload)

    // Check OPENAI_COMPATIBLE_API_KEY first (for custom endpoints)
    if (process.env.OPENAI_COMPATIBLE_API_KEY) {
      return true
    }

    // Then check OPENAI_API_KEY (for standard OpenAI)
    if (process.env.OPENAI_API_KEY) {
      return true
    }

    // Then check runtime config using default tenant
    const defaultTenantId = await getDefaultTenantId(payload)
    const apiKey = getSecret(defaultTenantId, 'OPENAI_COMPATIBLE_API_KEY', {
      throwIfNotFound: false,
    })
    if (!apiKey) {
      const fallbackKey = getSecret(defaultTenantId, 'OPENAI_API_KEY', { throwIfNotFound: false })
      return !!fallbackKey
    }
    return true
  } catch {
    return false
  }
}

/**
 * Get base URL for OpenAI-compatible endpoint
 * Checks OPENAI_COMPATIBLE_BASE_URL first, then falls back to OPENAI_BASE_URL
 */
export async function getOpenAICompatibleBaseUrl(payload: Payload): Promise<string | undefined> {
  try {
    await ensureConfigLoaded(payload)

    // Check environment variables first
    if (process.env.OPENAI_COMPATIBLE_BASE_URL) {
      return process.env.OPENAI_COMPATIBLE_BASE_URL
    }

    if (process.env.OPENAI_BASE_URL) {
      return process.env.OPENAI_BASE_URL
    }

    // Then check runtime config using default tenant
    const defaultTenantId = await getDefaultTenantId(payload)
    const baseUrl = getSecret(defaultTenantId, 'OPENAI_COMPATIBLE_BASE_URL', {
      throwIfNotFound: false,
    })
    if (!baseUrl) {
      return getSecret(defaultTenantId, 'OPENAI_BASE_URL', { throwIfNotFound: false })
    }
    return baseUrl
  } catch {
    return undefined
  }
}

/**
 * Get API key for OpenAI-compatible endpoint
 * Checks OPENAI_COMPATIBLE_API_KEY first, then falls back to OPENAI_API_KEY
 */
export async function getOpenAICompatibleApiKey(payload: Payload): Promise<string | undefined> {
  try {
    await ensureConfigLoaded(payload)

    // Check environment variables first
    if (process.env.OPENAI_COMPATIBLE_API_KEY) {
      return process.env.OPENAI_COMPATIBLE_API_KEY
    }

    if (process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_API_KEY
    }

    // Then check runtime config using default tenant
    const defaultTenantId = await getDefaultTenantId(payload)
    const apiKey = getSecret(defaultTenantId, 'OPENAI_COMPATIBLE_API_KEY', {
      throwIfNotFound: false,
    })
    if (!apiKey) {
      return getSecret(defaultTenantId, 'OPENAI_API_KEY', { throwIfNotFound: false })
    }
    return apiKey
  } catch {
    return undefined
  }
}

/**
 * Get or create OpenAI-compatible client singleton
 * @param payload - Payload instance for runtime config access
 * @throws OpenAIConfigError if API key not configured
 */
export async function getOpenAIClient(payload: Payload): Promise<OpenAI> {
  if (!openaiClient) {
    await ensureConfigLoaded(payload)

    // Get API key (supports both OPENAI_COMPATIBLE_API_KEY and OPENAI_API_KEY)
    let apiKey = process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY

    if (!apiKey) {
      const defaultTenantId = await getDefaultTenantId(payload)
      apiKey = getSecret(defaultTenantId, 'OPENAI_COMPATIBLE_API_KEY', { throwIfNotFound: false })
      if (!apiKey) {
        apiKey = getSecret(defaultTenantId, 'OPENAI_API_KEY', { throwIfNotFound: false })
      }
    }

    if (!apiKey) {
      throw new Error(
        'OPENAI_COMPATIBLE_API_KEY or OPENAI_API_KEY environment variable is not configured.',
      )
    }

    // Get base URL (supports both OPENAI_COMPATIBLE_BASE_URL and OPENAI_BASE_URL)
    const baseURL = process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL

    openaiClient = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    })
  }
  return openaiClient
}

/**
 * Reset client singleton (for testing)
 * @internal
 */
export function resetOpenAIClient(): void {
  openaiClient = null
}
