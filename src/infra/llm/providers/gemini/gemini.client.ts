/**
 * Gemini Client Module
 * Handles SDK initialization, singleton caching, and environment config
 *
 * @internal This module is used by gemini.provider.ts only
 */
import { getSecret, isConfigLoaded, loadRuntimeConfig } from '@/lib/config/runtime'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Payload } from 'payload'

let geminiClient: GoogleGenerativeAI | null = null

/**
 * Ensure runtime config is loaded
 */
async function ensureConfigLoaded(payload: Payload): Promise<void> {
  if (!isConfigLoaded()) {
    await loadRuntimeConfig(payload)
  }
}

/**
 * Check if Gemini API key is configured via runtime config
 */
export async function isGeminiApiKeyConfigured(payload?: Payload): Promise<boolean> {
  try {
    // Ensure config is loaded if payload provided
    if (payload) {
      await ensureConfigLoaded(payload)
    }

    // First check process.env for direct override
    if (process.env.GEMINI_API_KEY) {
      return true
    }

    // Then check runtime config (secrets are decrypted in memory)
    const apiKey = getSecret('GEMINI_API_KEY', { throwIfNotFound: false })
    return !!apiKey
  } catch {
    return false
  }
}

/**
 * Get or create Gemini client singleton
 * @param payload - Optional Payload instance for runtime config access
 * @throws GeminiConfigError if API key not configured
 */
export async function getGeminiClient(payload?: Payload): Promise<GoogleGenerativeAI> {
  if (!geminiClient) {
    // Ensure config is loaded if payload provided
    if (payload) {
      await ensureConfigLoaded(payload)
    }

    // First check process.env for direct override
    let apiKey = process.env.GEMINI_API_KEY

    // Then check runtime config (secrets are decrypted in memory)
    if (!apiKey) {
      apiKey = getSecret('GEMINI_API_KEY', { throwIfNotFound: false })
    }

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.')
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
