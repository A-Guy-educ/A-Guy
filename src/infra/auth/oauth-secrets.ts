/**
 * OAuth Secrets Helper
 * Provides access to OAuth-related secrets from tenant-scoped config
 *
 * All secrets are accessed via getSecret() from the runtime config.
 */
import { getSecret, isConfigLoaded, loadRuntimeConfig } from '@/lib/config/runtime'
import { getDefaultTenantId } from '@/lib/tenant/get-default-tenant'
import type { Payload } from 'payload'

/**
 * Get Google OAuth credentials from tenant-scoped config
 *
 * @param payload - Payload instance for runtime config access
 * @returns Object with clientId and clientSecret
 */
export async function getGoogleOAuthSecrets(
  payload: Payload,
): Promise<{ clientId: string; clientSecret: string }> {
  if (!payload) {
    throw new Error('Payload instance required for OAuth secrets')
  }

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
export async function getPreviewSecret(payload: Payload): Promise<string> {
  if (!payload) {
    throw new Error('Payload instance required for preview secret')
  }

  if (!isConfigLoaded()) {
    const defaultTenantId = await getDefaultTenantId(payload)
    await loadRuntimeConfig(payload, defaultTenantId)
  }

  const defaultTenantId = await getDefaultTenantId(payload)
  return getSecret(defaultTenantId, 'PREVIEW_SECRET', { throwIfNotFound: false }) || ''
}
