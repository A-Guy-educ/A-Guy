/**
 * Config Values Runtime Loader
 *
 * @fileType implementation
 * @domain config.runtime
 * @pattern singleton, in-memory-cache, domain-config-loader
 * @ai-summary Server-side runtime config values loader with DB→memory caching (tenant-scoped, domain-grouped)
 *
 * Security:
 * - Server-side only (throws on client)
 * - Tenant-scoped cache structure
 * - Domain-grouped for organized access
 *
 * Design Constraints:
 * - Tenant-scoped: each entry belongs to exactly one tenant
 * - Domain-grouped: Map<tenantId, Map<domain, config>>
 * - Explicit: must call loadConfigValues() before using getters
 * - Lazy loading: can auto-load via setPayloadGetterForLazyLoading()
 */

import type { ConfigDomain } from '@/infra/config/config-constants'
import type { ConfigValue } from '@/payload-types'
import type { Payload, Where } from 'payload'
import { ConfigValueNotFoundError } from './errors'
import type { ConfigValuesCache, LoadConfigValuesResult } from './types'

// ============================================
// Lazy Loading Support
// ============================================

/**
 * Getter function to obtain Payload instance (for lazy loading)
 */
type PayloadGetter = () => Promise<Payload>

let lazyPayloadGetter: PayloadGetter | null = null
let lazyLoadAttempted = false
let lazyLoadPromise: Promise<boolean> | null = null

/**
 * Register a Payload getter for lazy config loading
 * This allows getConfigDomain() to auto-load config on first access
 *
 * @param getter - Async function that returns Payload instance
 */
export function setPayloadGetterForLazyLoading(getter: PayloadGetter): void {
  lazyPayloadGetter = getter
}

/**
 * Check if lazy loading is configured
 */
function hasLazyLoading(): boolean {
  return lazyPayloadGetter !== null && !lazyLoadAttempted
}

/**
 * Auto-configure lazy loading using Payload config if not already set up
 * This makes the config system self-sufficient without requiring explicit setup
 */
async function autoConfigureLazyLoading(): Promise<void> {
  if (lazyPayloadGetter) {
    return // Already configured
  }

  try {
    // Dynamically import to avoid circular dependencies and enable tree-shaking
    const [{ getPayload }, config] = await Promise.all([
      import('payload'),
      import('@payload-config'),
    ])

    lazyPayloadGetter = async () => {
      return await getPayload({ config: config.default })
    }
  } catch (error) {
    // Log warning but don't throw - caller will handle missing config
    if (typeof console !== 'undefined' && console?.warn) {
      console.warn('Failed to auto-configure lazy loading for config values:', error)
    }
  }
}

/**
 * Attempt lazy loading of config values with concurrency protection
 * Returns true if loaded successfully, false otherwise
 *
 * Uses a shared promise to prevent duplicate concurrent loads
 */
async function tryLazyLoad(): Promise<boolean> {
  // If already loading, wait for that operation to complete
  if (lazyLoadPromise) {
    return await lazyLoadPromise
  }

  // If already attempted and failed, don't retry
  if (lazyLoadAttempted && !configValuesCache) {
    return false
  }

  // Auto-configure lazy loading if not set up
  if (!lazyPayloadGetter) {
    await autoConfigureLazyLoading()
  }

  // Still no getter after auto-configure? Give up
  if (!lazyPayloadGetter) {
    lazyLoadAttempted = true
    return false
  }

  // Mark as attempted before starting to prevent multiple concurrent attempts
  lazyLoadAttempted = true

  // Create shared promise for concurrent callers
  lazyLoadPromise = (async () => {
    try {
      const payload = await lazyPayloadGetter!()
      await loadConfigValues(payload)
      return true
    } catch (error) {
      // Log error but don't throw - let caller handle missing config gracefully
      if (typeof console !== 'undefined' && console?.warn) {
        console.warn('Failed to lazily load config values:', error)
      }
      return false
    } finally {
      // Clear promise after completion so subsequent calls can see the result
      lazyLoadPromise = null
    }
  })()

  return await lazyLoadPromise
}

// ============================================
// Module-Level State (Process Singleton)
// ============================================

let configValuesCache: ConfigValuesCache | null = null
let lastLoadConfigValuesResult: LoadConfigValuesResult | null = null
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
    throw new Error('ConfigValues is server-side only')
  }
}

/**
 * Check if config values have been loaded, or try lazy load
 * 
 * This function ensures config is always available by:
 * 1. Returning immediately if already loaded
 * 2. Auto-configuring lazy loading if needed
 * 3. Attempting to load config
 * 4. NEVER throwing - callers handle missing config gracefully
 */
async function assertLoadedOrLazyLoad(): Promise<void> {
  if (configValuesCache) {
    return // Already loaded
  }

  // Try lazy loading (will auto-configure if needed)
  await tryLazyLoad()

  // Note: We don't throw here anymore. If loading failed, configValuesCache
  // will still be null, and callers (getConfigDomain, getConfigValueByKey)
  // will handle it gracefully by returning defaults or empty objects.
}

// ============================================
// Core Loader Logic
// ============================================

/**
 * Load all tenant-scoped config values from DB into memory
 *
 * Design:
 * - Dependency injection: caller provides Payload instance
 * - Idempotent: safe to call multiple times (uses existing cache)
 * - Tenant-scoped cache structure: Map<tenantId, Map<domain, config>>
 * - Caches default tenant ID for global config lookups
 *
 * @param payload - Payload instance (must be initialized)
 * @param tenantId - Optional: load specific tenant only
 * @returns LoadConfigValuesResult with stats and any errors
 *
 * @throws Error if DB is unreachable (re-thrown, not wrapped)
 *
 * Usage:
 * ```typescript
 * import { getPayload } from 'payload'
 * import config from '@payload-config'
 * import { loadConfigValues } from '@/infra/config/runtime'
 *
 * const payload = await getPayload({ config })
 * await loadConfigValues(payload)
 * ```
 */
export async function loadConfigValues(
  payload: Payload,
  tenantId?: string,
): Promise<LoadConfigValuesResult> {
  assertServerSide()

  // Idempotent: return cached result if already loaded
  if (configValuesCache && lastLoadConfigValuesResult) {
    return lastLoadConfigValuesResult
  }

  const startTime = Date.now()
  const errors: LoadConfigValuesResult['errors'] = []
  const values = new Map<string, Map<ConfigDomain, Record<string, unknown>>>()

  // Cache default tenant ID (for global config lookups)
  if (!defaultTenantLoaded) {
    try {
      // Lazy import to avoid circular dependency
      const { getDefaultTenantId } = await import('@/server/repos/tenant/get-default-tenant')
      defaultTenantId = await getDefaultTenantId(payload)
      defaultTenantLoaded = true
    } catch (error) {
      // Log but continue - default tenant might be created later
      if (typeof payload.logger?.warn === 'function') {
        payload.logger.warn({
          msg: 'Could not load default tenant ID for config values',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }

  try {
    // Build query - optional tenant filter
    const where: Where = {}
    if (tenantId) {
      where.tenant = { equals: tenantId }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (payload.find as any)({
      collection: 'config_values',
      where,
      limit: 1000, // Reasonable limit for config entries
      overrideAccess: true,
    })

    // Process each entry with tenant scoping and domain grouping
    for (const doc of result.docs) {
      const {
        domain,
        config: configData,
        tenant,
      } = doc as ConfigValue & {
        tenant: { id: string } | string
      }
      const tId = typeof tenant === 'object' ? tenant.id : tenant

      if (!tId) {
        continue // Skip entries without tenant
      }

      // Initialize tenant map if needed
      if (!values.has(tId)) {
        values.set(tId, new Map())
      }

      try {
        // Parse JSON config if string (Payload may return parsed or string)
        const parsedConfig = typeof configData === 'string' ? JSON.parse(configData) : configData

        values.get(tId)!.set(domain as ConfigDomain, parsedConfig as Record<string, unknown>)
      } catch (error) {
        // Log error but continue loading other entries
        errors.push({
          domain,
          tenantId: tId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Initialize tenant-scoped cache
    const loadedAt = new Date()
    configValuesCache = {
      values,
      metadata: {
        loadedAt,
        entryCount: result.docs.length,
        domainCount: values.size,
      },
    }

    const duration = Date.now() - startTime

    // Store result for idempotent returns
    lastLoadConfigValuesResult = {
      success: errors.length === 0,
      valuesLoaded: result.docs.length,
      errors,
      loadedAt,
    }

    if (typeof payload.logger?.info === 'function') {
      payload.logger.info({
        msg: 'Config values loaded',
        valuesLoaded: lastLoadConfigValuesResult.valuesLoaded,
        tenantsLoaded: values.size,
        errorsCount: errors.length,
        durationMs: duration,
      })
    }

    return lastLoadConfigValuesResult
  } catch (error) {
    // Rethrow original error - do not wrap
    throw error
  }
}

/**
 * Force reload config values (clears cache, then reloads)
 * Useful for dev mode or manual refresh
 */
export async function reloadConfigValues(payload: Payload): Promise<LoadConfigValuesResult> {
  assertServerSide()

  // Reset state to force fresh load
  configValuesCache = null
  lastLoadConfigValuesResult = null
  defaultTenantId = null
  defaultTenantLoaded = false
  lazyLoadAttempted = false

  return loadConfigValues(payload)
}

// ============================================
// Public API: Tenant-Scoped Domain Getters
// ============================================

/**
 * Options for getConfigDomain and getConfigValueByKey
 */
export interface ConfigDomainOptions {
  /** Tenant ID to scope the lookup (optional, uses default tenant) */
  tenantId?: string
  /** Whether to throw if not found (default: true) */
  throwIfNotFound?: boolean
}

/**
 * Get all configuration for a specific domain and tenant
 *
 * @param domain - Configuration domain (chat, pdf_conversion, global)
 * @param options - Options for tenant ID and error handling
 * @returns The configuration object for the domain
 *
 * @throws ConfigValueNotFoundError if domain not found and throwIfNotFound is true
 */
export async function getConfigDomain<T = Record<string, unknown>>(
  domain: ConfigDomain,
  options?: { tenantId?: string; throwIfNotFound?: boolean },
): Promise<T> {
  assertServerSide()
  await assertLoadedOrLazyLoad()

  const { tenantId, throwIfNotFound = true } = options ?? {}
  const resolvedTenantId = tenantId ?? defaultTenantId

  // If config still not loaded after auto-load attempt, return empty object
  if (!configValuesCache) {
    if (throwIfNotFound) {
      throw new ConfigValueNotFoundError(
        domain,
        resolvedTenantId ?? 'unknown',
        undefined,
        'Config values could not be loaded',
      )
    }
    return {} as T
  }

  if (!resolvedTenantId) {
    // No tenant ID and no default tenant
    if (throwIfNotFound) {
      throw new Error('No tenant ID available for config lookup')
    }
    return {} as T
  }

  // Check tenant-specific cache
  const tenantDomains = configValuesCache.values.get(resolvedTenantId)
  if (tenantDomains?.has(domain)) {
    return tenantDomains.get(domain)! as T
  }

  // Return empty object for missing domain (graceful fallback)
  if (!throwIfNotFound) {
    return {} as T
  }

  throw new ConfigValueNotFoundError(domain, resolvedTenantId)
}

/**
 * Get a specific configuration value by domain and key
 *
 * @param domain - Configuration domain (chat, pdf_conversion, global)
 * @param key - Configuration key (nested keys supported with dot notation)
 * @param options - Options for tenant ID and default value
 * @returns The configuration value
 *
 * @throws ConfigValueNotFoundError if key not found and no default
 */
export async function getConfigValueByKey<T = unknown>(
  domain: ConfigDomain,
  key: string,
  options?: { tenantId?: string; defaultValue?: T; throwIfNotFound?: boolean },
): Promise<T> {
  assertServerSide()
  await assertLoadedOrLazyLoad()

  const { tenantId, defaultValue, throwIfNotFound = true } = options ?? {}
  const resolvedTenantId = tenantId ?? defaultTenantId

  // If config still not loaded after auto-load attempt, return default or undefined
  if (!configValuesCache) {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    if (!throwIfNotFound) {
      return undefined as T
    }
    throw new ConfigValueNotFoundError(
      domain,
      resolvedTenantId ?? 'unknown',
      key,
      'Config values could not be loaded',
    )
  }

  if (!resolvedTenantId) {
    // No tenant ID and no default tenant
    if (defaultValue !== undefined) {
      return defaultValue
    }
    if (!throwIfNotFound) {
      return undefined as T
    }
    throw new Error('No tenant ID available for config lookup')
  }

  // Get domain config
  const tenantDomains = configValuesCache.values.get(resolvedTenantId)
  const domainConfig = tenantDomains?.get(domain)

  if (!domainConfig) {
    // Return default or throw
    if (defaultValue !== undefined) {
      return defaultValue
    }
    if (!throwIfNotFound) {
      return undefined as T
    }
    throw new ConfigValueNotFoundError(domain, resolvedTenantId, key)
  }

  // Support nested keys with dot notation (e.g., 'provider.apiKey')
  const keys = key.split('.')
  let value: unknown = domainConfig

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      // Key not found
      if (defaultValue !== undefined) {
        return defaultValue
      }
      if (!throwIfNotFound) {
        return undefined as T
      }
      throw new ConfigValueNotFoundError(domain, resolvedTenantId, key)
    }
  }

  return value as T
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if config values have been loaded
 */
export function isConfigValuesLoaded(): boolean {
  return configValuesCache !== null && configValuesCache.metadata.loadedAt !== null
}

/**
 * Get cache metadata (for debugging/monitoring)
 */
export function getConfigValuesMetadata(): {
  loadedAt: Date | null
  entryCount: number
  tenantsLoaded: number
} | null {
  if (!configValuesCache) {
    return null
  }

  return {
    loadedAt: configValuesCache.metadata.loadedAt,
    entryCount: configValuesCache.metadata.entryCount,
    tenantsLoaded: configValuesCache.metadata.domainCount,
  }
}

/**
 * Get all loaded domains for a tenant (for introspection)
 */
export async function getConfigDomains(tenantId?: string): Promise<ConfigDomain[]> {
  assertServerSide()
  await assertLoadedOrLazyLoad()

  // If config still not loaded, return empty array
  if (!configValuesCache) {
    return []
  }

  const resolvedTenantId = tenantId ?? defaultTenantId
  if (!resolvedTenantId) {
    return []
  }

  const tenantDomains = configValuesCache.values.get(resolvedTenantId)
  if (!tenantDomains) {
    return []
  }

  // Cast keys to ConfigDomain since we only insert valid domain values
  return Array.from(tenantDomains.keys()) as ConfigDomain[]
}

/**
 * Get all loaded tenant IDs
 */
export function getLoadedConfigTenantIds(): string[] {
  return configValuesCache ? Array.from(configValuesCache.values.keys()) : []
}

/**
 * Clear the in-memory cache
 * Useful for testing or graceful shutdown
 */
export function clearConfigValuesCache(): void {
  configValuesCache = null
  lastLoadConfigValuesResult = null
  defaultTenantId = null
  defaultTenantLoaded = false
  lazyLoadAttempted = false
}

/**
 * Get the cached default tenant ID for config values
 */
export function getCachedConfigDefaultTenantId(): string | null {
  return defaultTenantId
}
