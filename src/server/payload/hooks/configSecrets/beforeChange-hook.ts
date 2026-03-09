/**
 * ConfigSecrets Before Change Hook
 *
 * @fileType hook
 * @domain config
 * @pattern validation, encryption
 * @ai-summary Encrypts secrets and validates config entries before save
 *
 * Security (CRITICAL):
 * - Always pass req to nested operations for transaction safety
 * - Encrypt all values (secrets-only collection)
 * - Enforce key immutability
 * - Store computed action in req.context for audit hook
 */

import type { CollectionBeforeChangeHook, Payload, Where } from 'payload'

import { isSnakeCase } from '@/infra/config/config-constants'
import { encryptSecret } from '@/infra/config/config-crypto'

// Type for ConfigSecrets data (partial for validation)
type ConfigSecretsFields = {
  key: string
  tenant: string | { id: string }
}

/**
 * ==========================================================================
 * Tenant+Key Uniqueness Check
 * CRITICAL: Must be deterministic and fail loudly
 * ==========================================================================
 */
async function checkTenantKeyUniqueness({
  data,
  operation,
  req,
  originalDoc,
}: {
  data: Partial<ConfigSecretsFields>
  operation: 'create' | 'update'
  req: { payload: Payload }
  originalDoc?: { id: string; tenant: string | object }
}): Promise<void> {
  const key = data.key
  const tenant = data.tenant

  if (!key) {
    throw new Error('Config key is required')
  }

  const tenantId = typeof tenant === 'object' ? tenant.id : tenant

  if (!tenantId) {
    throw new Error('Tenant is required for config entries')
  }

  // Build query to find conflicting entry
  const whereQuery: Where = {
    and: [
      { tenant: { equals: tenantId } },
      { key: { equals: key } },
      // On update, exclude current document
      ...(operation === 'update' && originalDoc?.id
        ? [{ id: { not_equals: originalDoc.id } }]
        : []),
    ],
  }

  const existing = await req.payload.find({
    collection: 'config_secrets',
    where: whereQuery,
    limit: 1,
    req, // Pass req for potential transaction safety
    overrideAccess: true, // Bypass access control for validation
  })

  if (existing.docs.length > 0) {
    throw new Error(
      `Config key "${key}" already exists for this tenant. ` +
        `Each tenant can have only one entry per key.`,
    )
  }
}

/**
 * Determine the action type based on operation and data
 */
function getAction(
  operation: 'create' | 'update',
  data: { enabled?: boolean },
  originalDoc?: { enabled?: boolean },
): 'created' | 'updated' | 'enabled' | 'disabled' {
  if (operation === 'create') {
    return 'created'
  }

  if (originalDoc && data.enabled !== undefined) {
    if (data.enabled && !originalDoc.enabled) {
      return 'enabled'
    }
    if (!data.enabled && originalDoc.enabled) {
      return 'disabled'
    }
  }

  return 'updated'
}

export const beforeChangeEncryptAndValidate: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
  originalDoc,
}) => {
  const { payload: _payload } = req // Kept for context, payload used in sub-functions

  // =========================================================================
  // Tenant+Key Uniqueness Check
  // =========================================================================
  if (operation === 'create' || operation === 'update') {
    await checkTenantKeyUniqueness({ data, operation, req, originalDoc })
  }

  // =========================================================================
  // Key Immutability Check
  // Only compare if data.key is provided (update may omit it)
  // =========================================================================
  if (operation === 'update' && data.key !== undefined && originalDoc?.key !== data.key) {
    throw new Error('Config key cannot be changed after creation')
  }

  // =========================================================================
  // Key Format Validation (snake_case) - only on create or if key is provided
  // =========================================================================
  if (data.key && !isSnakeCase(data.key)) {
    throw new Error('Config key must be snake_case (e.g., my_config_key)')
  }

  // =========================================================================
  // Encrypt Secrets (ALL values encrypted in secrets-only collection)
  // =========================================================================
  if (data.value) {
    // Always encrypt when value is provided (treat as rotation)
    // On create: always encrypt
    // On update: only encrypt if value is explicitly provided
    data.value = encryptSecret(data.value)
  } else if (operation === 'update' && originalDoc?.value) {
    // Preserve existing encrypted value when not provided on update
    // (afterRead hook clears value to '' for write-only UX, so partial
    // updates like toggling 'enabled' must not lose the encrypted value)
    data.value = originalDoc.value
  }

  // =========================================================================
  // Store action in context for afterChange hook
  // =========================================================================
  req.context.configAction = getAction(operation, data, originalDoc)

  return data
}
