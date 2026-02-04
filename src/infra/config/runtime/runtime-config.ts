/**
 * Runtime Config Loader
 *
 * @fileType implementation
 * @domain config.runtime
 * @pattern singleton, in-memory-cache, config-loader
 * @ai-summary Server-side runtime config loader for secrets only (DB→memory caching, tenant-scoped)
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
 * - Secrets-only: use ConfigValues for non-secret configuration
 */

import type { ConfigSecret } from '@/payload-types'
import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'
import type { Payload, Where } from 'payload'
import { decryptSecret } from '../config-crypto'
import { ConfigKeyNotFoundError, ConfigNotLoadedError } from './errors'
import type { LoadConfigResult, RuntimeConfigCache } from './types'

// ============================================
// Module-Level State (Process Singleton)
// ============================================

let cache: RuntimeConfigCache | null = null
let lastLoadResult: LoadConfigResult | null = null
let defaultTenantId: string | null = null
let defaultTenantLoaded = false

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
 * Load all enabled tenant-scoped config secrets from DB into memory
 *
 * Design:
 * - Dependency injection: caller provides Payload instance
 * - Idempotent: safe to call multiple times (uses existing cache)
 * - Only loads enabled=true entries
 * - Decrypts secrets using config-crypto
 * - Passes context flag to bypass write-only UX hook
 * - Tenant-scoped cache structure: Map<tenantId, Map<key, value>>
 * - Caches default tenant ID for global config lookups
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
 * import { loadRuntimeConfig } from '@/infra/config/runtime'
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
  const secrets = new Map<string, Map<string, string>>()

  // Cache default tenant ID (for global config lookups)
  if (!defaultTenantLoaded) {
    try {
      defaultTenantId = await getDefaultTenantId(payload)
      defaultTenantLoaded = true
    } catch (error) {
      // Log but continue - default tenant might be created later
      if (typeof payload.logger?.warn === 'function') {
        payload.logger.warn({
          msg: 'Could not load default tenant ID',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }

  try {
    // Build query - optional tenant filter
    const where: Where = { enabled: { equals: true } }
    if (tenantId) {
      where.tenant = { equals: tenantId }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (payload.find as any)({
      collection: 'config_secrets',
      where,
      limit: 1000, // Reasonable limit for config secrets
      overrideAccess: true,
      req: {
        context: {
          internalConfigLoad: true,
        },
      },
    })

    // Process each secret with tenant scoping
    for (const doc of result.docs) {
      const { key, value, tenant } = doc as ConfigSecret & { tenant: { id: string } | string }
      const tId = typeof tenant === 'object' ? tenant.id : tenant

      if (!tId) {
        continue // Skip entries without tenant
      }

      // Initialize tenant map if needed
      if (!secrets.has(tId)) {
        secrets.set(tId, new Map())
      }

      try {
        // Decrypt and cache the secret
        if (value && value.length > 0) {
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
      secrets,
      metadata: {
        loadedAt,
        secretCount: result.docs.length,
        tenantsLoaded: secrets.size,
      },
    }

    const duration = Date.now() - startTime

    // Store result for idempotent returns
    lastLoadResult = {
      success: errors.length === 0,
      secretsLoaded: Array.from(secrets.values()).reduce((sum, m) => sum + m.size, 0),
      errors,
      loadedAt,
    }

    // SECURITY: Never log secrets - only metadata
    if (typeof payload.logger?.info === 'function') {
      payload.logger.info({
        msg: 'Runtime config loaded',
        secretsLoaded: lastLoadResult.secretsLoaded,
        tenantsLoaded: secrets.size,
        errorsCount: errors.length,
        durationMs: duration,
      })
    }

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
  defaultTenantId = null
  defaultTenantLoaded = false

  return loadRuntimeConfig(payload)
}

// ============================================
// Public API: Tenant-Scoped Getters (Synchronous)
// ============================================

/**
 * Options for getSecret
 */
export interface GetSecretOptions {
  /** Tenant ID to scope the lookup (optional, uses default tenant) */
  tenantId?: string
  /** Default value if key not found */
  defaultValue?: string
  /** Whether to throw if not found (default: true) */
  throwIfNotFound?: boolean
}

/**
 * Get a secret for a specific tenant
 *
 * SECURITY:
 * - Never logs the secret value
 * - Throws explicit error if not found
 *
 * @param key - Secret key (exact match required)
 * @param options - Options for tenant ID, default value, and error handling
 * @returns The decrypted secret value
 *
 * @throws ConfigNotLoadedError if config not loaded
 * @throws ConfigKeyNotFoundError if key not found and no default
 */
export function getSecret(
  key: string,
  options?: { tenantId?: string; defaultValue?: string; throwIfNotFound?: boolean },
): string {
  assertServerSide()
  assertLoaded()

  const { tenantId, defaultValue, throwIfNotFound = true } = options ?? {}
  const resolvedTenantId = tenantId ?? defaultTenantId
  if (!resolvedTenantId) {
    throw new ConfigNotLoadedError()
  }

  // Check tenant-specific cache (secrets)
  const tenantSecrets = cache!.secrets.get(resolvedTenantId)
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

  throw new ConfigKeyNotFoundError(key, 'secret', resolvedTenantId)
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
  secretCount: number
  tenantsLoaded: number
} | null {
  if (!cache) {
    return null
  }

  return {
    loadedAt: cache.metadata.loadedAt,
    secretCount: cache.metadata.secretCount,
    tenantsLoaded: cache.metadata.tenantsLoaded,
  }
}

/**
 * Get all secret keys for a tenant (for introspection, not values)
 */
export function getSecretKeys(tenantId?: string): string[] {
  assertServerSide()
  assertLoaded()
  const resolvedTenantId = tenantId ?? defaultTenantId
  if (!resolvedTenantId) {
    return []
  }
  return cache!.secrets.get(resolvedTenantId)
    ? Array.from(cache!.secrets.get(resolvedTenantId)!.keys())
    : []
}

/**
 * Get all loaded tenant IDs
 */
export function getLoadedTenantIds(): string[] {
  return cache ? Array.from(cache.secrets.keys()) : []
}

/**
 * Get the cached default tenant ID
 */
export function getCachedDefaultTenantId(): string | null {
  return defaultTenantId
}

/**
 * Clear the in-memory cache
 * Useful for testing or graceful shutdown
 */
export function clearConfigCache(): void {
  cache = null
  lastLoadResult = null
  defaultTenantId = null
  defaultTenantLoaded = false
}
