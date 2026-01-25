/**
 * OAuth Secrets Helper
 * Provides access to OAuth-related secrets from tenant-scoped config
 *
 * All secrets are accessed via getSecret() from the runtime config.
 * Tests should use setTestMode() to enable process.env fallback.
 */
import { getSecret, isConfigLoaded, loadRuntimeConfig } from '@/lib/config/runtime'
import { getDefaultTenantId } from '@/lib/tenant/get-default-tenant'
import type { Payload } from 'payload'

// Test mode flag - when enabled, uses process.env directly
let testMode = false

/**
 * Enable test mode - uses process.env directly
 * @internal
 */
export function setOAuthTestMode(enabled: boolean): void {
  testMode = enabled
}

/**
 * Get Google OAuth credentials from tenant-scoped config
 *
 * @param payload - Payload instance for runtime config access
 * @returns Object with clientId and clientSecret
 */
export async function getGoogleOAuthSecrets(
  payload?: Payload,
): Promise<{ clientId: string; clientSecret: string }> {
  // Test mode: use process.env directly
  if (testMode || !payload) {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }
  }

  // Use tenant-scoped config
  if (!isConfigLoaded()) {
    const defaultTenantId = await getDefaultTenantId(payload)
    await loadRuntimeConfig(payload, defaultTenantId)
  }

  const defaultTenantId = await getDefaultTenantId(payload)
  const clientId = getSecret(defaultTenantId, 'GOOGLE_CLIENT_ID', { throwIfNotFound: false })
  const clientSecret = getSecret(defaultTenantId, 'GOOGLE_CLIENT_SECRET', {
    throwIfNotFound: false,
  })

  return { clientId, clientSecret }
}

/**
 * Get Preview Secret from tenant-scoped config
 *
 * @param payload - Payload instance for runtime config access
 * @returns Preview secret string
 */
export async function getPreviewSecret(payload?: Payload): Promise<string> {
  // Test mode: use process.env directly
  if (testMode || !payload) {
    return process.env.PREVIEW_SECRET || ''
  }

  // Use tenant-scoped config
  if (!isConfigLoaded()) {
    const defaultTenantId = await getDefaultTenantId(payload)
    await loadRuntimeConfig(payload, defaultTenantId)
  }

  const defaultTenantId = await getDefaultTenantId(payload)
  return getSecret(defaultTenantId, 'PREVIEW_SECRET', { throwIfNotFound: false }) || ''
}
