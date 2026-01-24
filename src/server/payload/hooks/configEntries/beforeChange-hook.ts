/**
 * ConfigEntries Before Change Hook
 *
 * @fileType hook
 * @domain config
 * @pattern validation, encryption
 * @ai-summary Encrypts secrets and validates config entries before save
 *
 * Security (CRITICAL):
 * - Always pass req to nested operations for transaction safety
 * - Encrypt secrets before storage
 * - Enforce key and kind immutability
 * - Store computed action in req.context for audit hook
 */

import type { CollectionBeforeChangeHook } from 'payload'

import { ConfigKind, isSnakeCase, looksLikeSecret } from '@/lib/config/config-constants'
import { encryptSecret } from '@/lib/config/config-crypto'

/**
 * Determine the action type based on operation and data
 */
function getAction(
  operation: 'create' | 'update',
  data: { enabled?: boolean; kind?: string },
  originalDoc?: { enabled?: boolean; kind?: string },
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
  const { payload } = req

  // =========================================================================
  // Key Immutability Check
  // Only compare if data.key is provided (update may omit it)
  // =========================================================================
  if (operation === 'update' && data.key !== undefined && originalDoc?.key !== data.key) {
    throw new Error('Config key cannot be changed after creation')
  }

  // =========================================================================
  // Kind Immutability Check
  // Only compare if data.kind is provided (update may omit it)
  // =========================================================================
  if (operation === 'update' && data.kind !== undefined && originalDoc?.kind !== data.kind) {
    throw new Error('Config kind cannot be changed after creation')
  }

  // =========================================================================
  // Key Format Validation (snake_case) - only on create or if key is provided
  // =========================================================================
  if (data.key && !isSnakeCase(data.key)) {
    throw new Error('Config key must be snake_case (e.g., my_config_key)')
  }

  // =========================================================================
  // Secret-Like Key Warning (soft validation)
  // =========================================================================
  if (data.kind === ConfigKind.Variable && data.key && looksLikeSecret(data.key)) {
    payload.logger.warn({
      msg: 'Config entry with variable kind has secret-like key',
      key: data.key,
      userId: req.user?.id,
    })
  }

  // =========================================================================
  // Encrypt Secrets (deterministic - always encrypt when value provided)
  // =========================================================================
  if (data.kind === ConfigKind.Secret && data.value) {
    // Always encrypt when value is provided (treat as rotation)
    // On create: always encrypt
    // On update: only encrypt if value is explicitly provided
    data.value = encryptSecret(data.value)
  }

  // =========================================================================
  // Store action in context for afterChange hook
  // =========================================================================
  req.context.configAction = getAction(operation, data, originalDoc)

  return data
}
