/**
 * ConfigValues Before Change Hook
 *
 * @fileType hook
 * @domain config
 * @pattern validation, secret-detection
 * @ai-summary Validates config values and detects secret-like keys before save
 *
 * Security:
 * - Always pass req to nested operations for transaction safety
 * - Warn about secret-like keys in config values
 * - Enforce tenant + domain uniqueness
 */

import type { CollectionBeforeChangeHook, Payload, Where } from 'payload'

import { looksLikeSecret } from '@/infra/config/config-constants'

// Type for ConfigValues data (partial for validation)
type ConfigValuesFields = {
  domain: string
  config: Record<string, unknown>
  tenant: string | { id: string }
}

/**
 * ==========================================================================
 * Tenant+Domain Uniqueness Check
 * CRITICAL: Must be deterministic and fail loudly
 * ==========================================================================
 */
async function checkTenantDomainUniqueness({
  data,
  operation,
  req,
  originalDoc,
}: {
  data: Partial<ConfigValuesFields>
  operation: 'create' | 'update'
  req: { payload: Payload }
  originalDoc?: { id: string; tenant: string | object }
}): Promise<void> {
  const domain = data.domain
  const tenant = data.tenant

  if (!domain) {
    throw new Error('Config domain is required')
  }

  const tenantId = typeof tenant === 'object' ? tenant.id : tenant

  if (!tenantId) {
    throw new Error('Tenant is required for config values')
  }

  // Build query to find conflicting entry
  const whereQuery: Where = {
    and: [
      { tenant: { equals: tenantId } },
      { domain: { equals: domain } },
      // On update, exclude current document
      ...(operation === 'update' && originalDoc?.id
        ? [{ id: { not_equals: originalDoc.id } }]
        : []),
    ],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (req.payload.find as any)({
    collection: 'config_values',
    where: whereQuery,
    limit: 1,
    req, // Pass req for potential transaction safety
    overrideAccess: true, // Bypass access control for validation
  })

  if (existing.docs.length > 0) {
    throw new Error(
      `Config for domain "${domain}" already exists for this tenant. ` +
        `Each tenant can have only one config entry per domain.`,
    )
  }
}

/**
 * ==========================================================================
 * Secret-Like Key Detection (Soft Validation)
 * ==========================================================================
 */
function detectSecretKeys(config: Record<string, unknown>): string[] {
  const secretKeys: string[] = []

  function traverse(obj: Record<string, unknown>, prefix = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key

      if (looksLikeSecret(key)) {
        secretKeys.push(fullKey)
      }

      // Recurse into nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        traverse(value as Record<string, unknown>, fullKey)
      }
    }
  }

  if (config && typeof config === 'object') {
    traverse(config)
  }

  return secretKeys
}

/**
 * ==========================================================================
 * Main Hook
 * ==========================================================================
 */
export const beforeChangeValidateConfigValues: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
  originalDoc,
}) => {
  const { payload } = req

  // =========================================================================
  // Tenant+Domain Uniqueness Check
  // =========================================================================
  if (operation === 'create' || operation === 'update') {
    await checkTenantDomainUniqueness({ data, operation, req, originalDoc })
  }

  // =========================================================================
  // Secret-Like Key Detection (soft validation)
  // =========================================================================
  if (data.config && typeof data.config === 'object') {
    const secretKeys = detectSecretKeys(data.config)

    if (secretKeys.length > 0) {
      payload.logger.warn({
        msg: 'Config values contain secret-like keys',
        keys: secretKeys,
        tenant: data.tenant,
        domain: data.domain,
        userId: req.user?.id,
      })
    }
  }

  return data
}
