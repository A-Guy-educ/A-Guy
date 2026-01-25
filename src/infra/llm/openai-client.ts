/**
 * OpenAI Client Factory
 * Creates and caches OpenAI clients using tenant-scoped secrets
 *
 * @internal This module is used by llm services (summary, memory-extraction, embeddings)
 */
import { getSecret, isConfigLoaded, loadRuntimeConfig } from '@/lib/config/runtime'
import { getDefaultTenantId } from '@/lib/tenant/get-default-tenant'
import { OpenAI } from 'openai'
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
 * Get or create OpenAI client singleton
 * Uses tenant-scoped secret storage
 *
 * @param payload - Payload instance for runtime config access
 * @returns OpenAI client instance
 * @throws Error if OPENAI_API_KEY not configured
 */
export async function getOpenAIClient(payload: Payload): Promise<OpenAI> {
  if (!openaiClient) {
    // Ensure config is loaded
    await ensureConfigLoaded(payload)

    // Get API key from tenant-scoped secret storage
    const defaultTenantId = await getDefaultTenantId(payload)
    const apiKey = getSecret(defaultTenantId, 'OPENAI_API_KEY', { throwIfNotFound: false })

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in tenant config.')
    }

    openaiClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // Safe in Node.js/test environment
    })
  }
  return openaiClient
}

/**
 * Get OpenAI API key from tenant-scoped secret
 * For use where full client isn't needed
 *
 * @param payload - Payload instance for runtime config access
 * @param options - Options for error handling
 * @returns API key string or default/empty based on options
 */
export async function getOpenAIApiKey(
  payload: Payload,
  options?: { throwIfNotFound?: boolean },
): Promise<string> {
  await ensureConfigLoaded(payload)
  const defaultTenantId = await getDefaultTenantId(payload)
  return getSecret(defaultTenantId, 'OPENAI_API_KEY', options)
}

/**
 * Reset client singleton (for testing)
 * @internal
 */
export function resetOpenAIClient(): void {
  openaiClient = null
}
