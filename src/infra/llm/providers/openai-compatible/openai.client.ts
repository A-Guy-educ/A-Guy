/**
 * OpenAI-Compatible Provider - Client Module
 * Handles SDK initialization, singleton caching, and environment config
 *
 * This provider is for OpenAI-compatible APIs (MiniMax, TogetherAI, etc.)
 * and should ONLY use OPENAI_COMPATIBLE_API_KEY - never falls back to OPENAI_API_KEY
 *
 * @internal This module is used by openai-compatible.provider.ts only
 */
import { getSecret, isConfigLoaded, loadRuntimeConfig } from '@/infra/config/runtime'
import { logger } from '@/infra/utils/logger'
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
 * Check if OpenAI-compatible API key is configured
 * ONLY checks OPENAI_COMPATIBLE_API_KEY - no fallback to OPENAI_API_KEY
 */
export async function isOpenAICompatibleApiKeyConfigured(payload: Payload): Promise<boolean> {
  try {
    await ensureConfigLoaded(payload)

    // Check environment variable first
    if (process.env.OPENAI_COMPATIBLE_API_KEY) {
      return true
    }

    // Then check runtime config using default tenant
    const defaultTenantId = await getDefaultTenantId(payload)
    const apiKey = getSecret('OPENAI_COMPATIBLE_API_KEY', {
      tenantId: defaultTenantId,
      throwIfNotFound: false,
    })
    return !!apiKey
  } catch {
    return false
  }
}

/**
 * Get base URL for OpenAI-compatible endpoint
 * ONLY checks OPENAI_COMPATIBLE_BASE_URL - no fallback to OPENAI_BASE_URL
 */
export async function getOpenAICompatibleBaseUrl(payload: Payload): Promise<string | undefined> {
  try {
    await ensureConfigLoaded(payload)

    // Check environment variable first
    if (process.env.OPENAI_COMPATIBLE_BASE_URL) {
      return process.env.OPENAI_COMPATIBLE_BASE_URL
    }

    // Then check runtime config using default tenant
    const defaultTenantId = await getDefaultTenantId(payload)
    return getSecret('OPENAI_COMPATIBLE_BASE_URL', {
      tenantId: defaultTenantId,
      throwIfNotFound: false,
    })
  } catch {
    return undefined
  }
}

/**
 * Get API key for OpenAI-compatible endpoint
 * ONLY returns OPENAI_COMPATIBLE_API_KEY - no fallback to OPENAI_API_KEY
 */
export async function getOpenAICompatibleApiKey(payload: Payload): Promise<string | undefined> {
  try {
    await ensureConfigLoaded(payload)

    // Check environment variable first
    if (process.env.OPENAI_COMPATIBLE_API_KEY) {
      return process.env.OPENAI_COMPATIBLE_API_KEY
    }

    // Then check runtime config using default tenant
    const defaultTenantId = await getDefaultTenantId(payload)
    return getSecret('OPENAI_COMPATIBLE_API_KEY', {
      tenantId: defaultTenantId,
      throwIfNotFound: false,
    })
  } catch {
    return undefined
  }
}

/**
 * Get or create OpenAI-compatible client singleton
 * @param payload - Payload instance for runtime config access
 * @throws Error if OPENAI_COMPATIBLE_API_KEY is not configured
 */
export async function getOpenAICompatibleClient(payload: Payload): Promise<OpenAI> {
  if (!openaiClient) {
    await ensureConfigLoaded(payload)

    // Get API key - ONLY use OPENAI_COMPATIBLE_API_KEY
    let apiKey = process.env.OPENAI_COMPATIBLE_API_KEY

    if (!apiKey) {
      const defaultTenantId = await getDefaultTenantId(payload)
      apiKey = getSecret('OPENAI_COMPATIBLE_API_KEY', {
        tenantId: defaultTenantId,
        throwIfNotFound: false,
      })
    }

    if (!apiKey) {
      throw new Error(
        'OPENAI_COMPATIBLE_API_KEY environment variable is not configured. ' +
          'This provider does not fall back to OPENAI_API_KEY.',
      )
    }

    // Get base URL - ONLY use OPENAI_COMPATIBLE_BASE_URL
    const baseURL =
      process.env.OPENAI_COMPATIBLE_BASE_URL || (await getOpenAICompatibleBaseUrl(payload))

    // Log client initialization
    const keyPrefix = apiKey.substring(0, 7)
    const keySuffix = apiKey.substring(apiKey.length - 4)
    logger.debug(
      { baseURL: baseURL || 'default', keyPrefix, keySuffix },
      '[OpenAICompatibleClient] Initializing',
    )

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
export function resetOpenAICompatibleClient(): void {
  openaiClient = null
}
