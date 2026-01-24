/**
 * Runtime Config Loader
 *
 * @fileType implementation
 * @domain config.runtime
 * @pattern singleton, in-memory-cache, config-loader
 * @ai-summary Server-side runtime config loader with DB→memory caching (tenant-scoped)
 *
 * Security:
 * - Server-side only (throws on client)
 * - Secrets never logged
 * - Explicit error messages
 * - process.env override DISABLED for tenant-scoped config (per spec-3)
 *
 * Design Constraints:
 * - Tenant-scoped: each entry belongs to exactly one tenant
 * - Explicit: must call loadRuntimeConfig() before using getters
 * - Minimal: no startup hooks, no health endpoints, no lazy loading
 */

import type { ConfigEntry } from '@/payload-types'
import type { Payload, Where } from 'payload'
import { ConfigKind } from '../config-constants'
import { decryptSecret } from '../config-crypto'
import { ConfigKeyNotFoundError, ConfigNotLoadedError } from './errors'
import type { LoadConfigResult, RuntimeConfigCache } from './types'

// ============================================
// Module-Level State (Process Singleton)
// ============================================

let cache: RuntimeConfigCache | null = null
let lastLoadResult: LoadConfigResult | null = null

// ============================================
// Type Guards & Validators
// ============================================

/**
 * Check if we're running on the server
 * CRITICAL: Never allow client-side access
 */
function assertServerSide(): void {
  if (typeof window !== 'undefined') {
    throw new Error('RuntimeConfig is server-side only')
  }
}

/**
 * Check if config has been loaded
 */
function assertLoaded(): void {
  if (!cache) {
    throw new ConfigNotLoadedError()
  }
}

// ============================================
// Core Loader Logic
// ============================================

/**
 * Load all enabled tenant-scoped config entries from DB into memory
 *
 * Design:
 * - Dependency injection: caller provides Payload instance
 * - Idempotent: safe to call multiple times (uses existing cache)
 * - Only loads enabled=true entries
 * - Decrypts secrets using config-crypto
 * - Passes context flag to bypass write-only UX hook
 * - Tenant-scoped cache structure: Map<tenantId, Map<key, value>>
 *
 * @param payload - Payload instance (must be initialized)
 * @param tenantId - Optional: load specific tenant only
 * @returns LoadConfigResult with stats and any errors
 *
 * @throws Error if DB is unreachable (re-thrown, not wrapped)
 *
 * Usage:
 * ```typescript
 * import { getPayload } from 'payload'
 * import config from '@payload-config'
 * import { loadRuntimeConfig } from '@/lib/config/runtime'
 *
 * const payload = await getPayload({ config })
 * await loadRuntimeConfig(payload)
 * ```
 */
export async function loadRuntimeConfig(
  payload: Payload,
  tenantId?: string,
): Promise<LoadConfigResult> {
  assertServerSide()

  // Idempotent: return cached result if already loaded
  if (cache && lastLoadResult) {
    return lastLoadResult
  }

  const startTime = Date.now()
  const errors: LoadConfigResult['errors'] = []
  const variables = new Map<string, Map<string, string>>()
  const secrets = new Map<string, Map<string, string>>()

  try {
    // Build query - optional tenant filter
    const where: Where = { enabled: { equals: true } }
    if (tenantId) {
      where.tenant = { equals: tenantId }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (payload.find as any)({
      collection: 'config_entries',
      where,
      limit: 1000, // Reasonable limit for config entries
      overrideAccess: true,
      req: {
        context: {
          internalConfigLoad: true,
        },
      },
    })

    // Process each entry with tenant scoping
    for (const doc of result.docs) {
      const { key, kind, value, tenant } = doc as ConfigEntry & { tenant: { id: string } | string }
      const tId = typeof tenant === 'object' ? tenant.id : tenant

      if (!tId) {
        continue // Skip entries without tenant
      }

      // Initialize tenant maps if needed
      if (!variables.has(tId)) {
        variables.set(tId, new Map())
        secrets.set(tId, new Map())
      }

      try {
        if (kind === ConfigKind.Variable) {
          variables.get(tId)!.set(key, value)
        } else if (kind === ConfigKind.Secret && value && value.length > 0) {
          secrets.get(tId)!.set(key, decryptSecret(value))
        }
      } catch (error) {
        // Log error but continue loading other entries
        errors.push({
          key,
          tenantId: tId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Initialize tenant-scoped cache
    const loadedAt = new Date()
    cache = {
      variables,
      secrets,
      metadata: {
        loadedAt,
        entryCount: result.docs.length,
        tenantsLoaded: variables.size,
      },
    }

    const duration = Date.now() - startTime

    // Store result for idempotent returns
    lastLoadResult = {
      success: errors.length === 0,
      variablesLoaded: Array.from(variables.values()).reduce((sum, m) => sum + m.size, 0),
      secretsLoaded: Array.from(secrets.values()).reduce((sum, m) => sum + m.size, 0),
      errors,
      loadedAt,
    }

    // SECURITY: Never log secrets - only metadata
    payload.logger.info({
      msg: 'Runtime config loaded',
      variablesLoaded: lastLoadResult.variablesLoaded,
      secretsLoaded: lastLoadResult.secretsLoaded,
      tenantsLoaded: variables.size,
      errorsCount: errors.length,
      durationMs: duration,
    })

    return lastLoadResult
  } catch (error) {
    // Rethrow original error - do not wrap (Option A)
    throw error
  }
}

/**
 * Force reload config (clears cache, then reloads)
 * Useful for dev mode or manual refresh
 */
export async function reloadRuntimeConfig(payload: Payload): Promise<LoadConfigResult> {
  assertServerSide()

  // Reset state to force fresh load
  cache = null
  lastLoadResult = null

  return loadRuntimeConfig(payload)
}

// ============================================
// Public API: Tenant-Scoped Getters (Synchronous)
// ============================================

/**
 * Get a configuration variable for a specific tenant
 *
 * Note: process.env override is DISABLED for tenant-scoped config (per spec-3)
 *
 * @param tenantId - Tenant ID to scope the lookup
 * @param key - Configuration key (exact match required)
 * @param options - Options for default value and error handling
 * @returns The configuration value
 *
 * @throws ConfigNotLoadedError if config not loaded
 * @throws ConfigKeyNotFoundError if key not found and no default
 */
export function getVariable(
  tenantId: string,
  key: string,
  options?: { defaultValue?: string; throwIfNotFound?: boolean },
): string {
  assertServerSide()
  assertLoaded()

  const { defaultValue, throwIfNotFound = true } = options ?? {}

  // Check tenant-specific cache
  const tenantVariables = cache!.variables.get(tenantId)
  if (tenantVariables?.has(key)) {
    return tenantVariables.get(key)!
  }

  // Return default or throw
  if (defaultValue !== undefined) {
    return defaultValue
  }

  if (!throwIfNotFound) {
    return ''
  }

  throw new ConfigKeyNotFoundError(key, 'variable', tenantId)
}

/**
 * Get a secret for a specific tenant
 *
 * SECURITY:
 * - Never logs the secret value
 * - Throws explicit error if not found
 *
 * @param tenantId - Tenant ID to scope the lookup
 * @param key - Secret key (exact match required)
 * @param options - Options for default value and error handling
 * @returns The decrypted secret value
 *
 * @throws ConfigNotLoadedError if config not loaded
 * @throws ConfigKeyNotFoundError if key not found and no default
 */
export function getSecret(
  tenantId: string,
  key: string,
  options?: { defaultValue?: string; throwIfNotFound?: boolean },
): string {
  assertServerSide()
  assertLoaded()

  const { defaultValue, throwIfNotFound = true } = options ?? {}

  // Check tenant-specific cache (secrets)
  const tenantSecrets = cache!.secrets.get(tenantId)
  if (tenantSecrets?.has(key)) {
    return tenantSecrets.get(key)!
  }

  // Return default or throw
  if (defaultValue !== undefined) {
    return defaultValue
  }

  if (!throwIfNotFound) {
    return ''
  }

  throw new ConfigKeyNotFoundError(key, 'secret', tenantId)
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if config has been loaded
 */
export function isConfigLoaded(): boolean {
  return cache !== null && cache.metadata.loadedAt !== null
}

/**
 * Get cache metadata (for debugging/monitoring)
 * Note: Does not expose secret values
 */
export function getCacheMetadata(): {
  loadedAt: Date | null
  entryCount: number
  variableCount: number
  secretCount: number
  tenantsLoaded: number
} | null {
  if (!cache) {
    return null
  }

  return {
    loadedAt: cache.metadata.loadedAt,
    entryCount: cache.metadata.entryCount,
    variableCount: Array.from(cache.variables.values()).reduce((sum, m) => sum + m.size, 0),
    secretCount: Array.from(cache.secrets.values()).reduce((sum, m) => sum + m.size, 0),
    tenantsLoaded: cache.metadata.tenantsLoaded,
  }
}

/**
 * Get all keys for a tenant (for introspection)
 */
export function getVariableKeys(tenantId: string): string[] {
  assertServerSide()
  assertLoaded()
  return cache!.variables.get(tenantId) ? Array.from(cache!.variables.get(tenantId)!.keys()) : []
}

/**
 * Get all secret keys for a tenant (for introspection, not values)
 */
export function getSecretKeys(tenantId: string): string[] {
  assertServerSide()
  assertLoaded()
  return cache!.secrets.get(tenantId) ? Array.from(cache!.secrets.get(tenantId)!.keys()) : []
}

/**
 * Get all loaded tenant IDs
 */
export function getLoadedTenantIds(): string[] {
  return cache ? Array.from(cache.variables.keys()) : []
}

/**
 * Clear the in-memory cache
 * Useful for testing or graceful shutdown
 */
export function clearConfigCache(): void {
  cache = null
  lastLoadResult = null
}

// ============================================
// Deprecated: Legacy API (for backward compatibility during migration)
// ============================================

/**
 * @deprecated Use getVariable(tenantId, key) instead
 * This function is kept for backward compatibility but will throw
 * with a migration message.
 */
export function getVariableLegacy(
  _key: string,
  _options?: { defaultValue?: string; throwIfNotFound?: boolean },
): string {
  throw new Error(
    'Legacy getVariable() is deprecated. Use getVariable(tenantId, key) instead. ' +
      'Config entries are now tenant-scoped.',
  )
}

/**
 * @deprecated Use getSecret(tenantId, key) instead
 * This function is kept for backward compatibility but will throw
 * with a migration message.
 */
export function getSecretLegacy(
  _key: string,
  _options?: { defaultValue?: string; throwIfNotFound?: boolean },
): string {
  throw new Error(
    'Legacy getSecret() is deprecated. Use getSecret(tenantId, key) instead. ' +
      'Config entries are now tenant-scoped.',
  )
}
