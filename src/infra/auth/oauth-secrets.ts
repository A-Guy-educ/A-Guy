/**
 * OAuth Secrets Helper
 * Provides access to OAuth-related secrets from tenant-scoped config
 *
 * Supports fallback to process.env for development/testing convenience
 * but prefers tenant-scoped secrets in production.
 */
import { getSecret, isConfigLoaded, loadRuntimeConfig } from '@/lib/config/runtime'
import { getDefaultTenantId } from '@/lib/tenant/get-default-tenant'
import type { Payload } from 'payload'

/**
 * Get Google OAuth credentials from tenant-scoped config
 * Falls back to process.env if not found in config
 *
 * @param payload - Optional Payload instance for runtime config access
 * @returns Object with clientId and clientSecret
 */
export async function getGoogleOAuthSecrets(
  payload?: Payload,
): Promise<{ clientId: string; clientSecret: string }> {
  // Try to use tenant-scoped config if available
  if (payload) {
    try {
      if (!isConfigLoaded()) {
        const defaultTenantId = await getDefaultTenantId(payload)
        await loadRuntimeConfig(payload, defaultTenantId)
      }

      const defaultTenantId = await getDefaultTenantId(payload)
      const clientId = getSecret(defaultTenantId, 'GOOGLE_CLIENT_ID', { throwIfNotFound: false })
      const clientSecret = getSecret(defaultTenantId, 'GOOGLE_CLIENT_SECRET', {
        throwIfNotFound: false,
      })

      if (clientId && clientSecret) {
        return { clientId, clientSecret }
      }
    } catch {
      // Fall through to env fallback
    }
  }

  // Fallback to process.env for development/testing
  /* eslint-disable aguy/no-direct-secret-access -- Intentionally allowed for test/dev convenience */
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  }
  /* eslint-enable aguy/no-direct-secret-access */
}

/**
 * Get Preview Secret from tenant-scoped config
 * Falls back to process.env if not found
 *
 * @param payload - Optional Payload instance for runtime config access
 * @returns Preview secret string
 */
export async function getPreviewSecret(payload?: Payload): Promise<string> {
  if (payload) {
    try {
      if (!isConfigLoaded()) {
        const defaultTenantId = await getDefaultTenantId(payload)
        await loadRuntimeConfig(payload, defaultTenantId)
      }

      const defaultTenantId = await getDefaultTenantId(payload)
      const secret = getSecret(defaultTenantId, 'PREVIEW_SECRET', { throwIfNotFound: false })

      if (secret) {
        return secret
      }
    } catch {
      // Fall through to env fallback
    }
  }

  // eslint-disable-next-line aguy/no-direct-secret-access -- Intentionally allowed for test/dev convenience
  return process.env.PREVIEW_SECRET || ''
}
