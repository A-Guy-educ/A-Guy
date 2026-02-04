/**
 * Runtime Config Types
 *
 * @fileType type-definition
 * @domain config.runtime
 * @pattern types
 */

import type { ConfigDomain } from '../config-constants'

/**
 * Shape of the in-memory cache for ConfigSecrets (secrets-only, tenant-scoped)
 */
export interface SecretsConfigCache {
  /** Tenant-scoped decrypted secrets: Map<tenantId, Map<key, value>> */
  secrets: Map<string, Map<string, string>>
  /** Metadata about the cache state */
  metadata: {
    loadedAt: Date | null
    secretCount: number
    tenantsLoaded: number
  }
}

/**
 * Result of loading tenant-scoped config secrets
 */
export interface LoadConfigResult {
  success: boolean
  secretsLoaded: number
  errors: Array<{ key: string; tenantId: string; error: string }>
  loadedAt: Date
}

/**
 * Shape of the in-memory cache for ConfigValues (domain-grouped, tenant-scoped)
 */
export interface ConfigValuesCache {
  /** Tenant-scoped domain-grouped config: Map<tenantId, Map<domain, config>> */
  values: Map<string, Map<ConfigDomain, Record<string, unknown>>>
  /** Metadata about the cache state */
  metadata: {
    loadedAt: Date | null
    entryCount: number
    domainCount: number
  }
}

/**
 * Result of loading tenant-scoped config values
 */
export interface LoadConfigValuesResult {
  success: boolean
  valuesLoaded: number
  errors: Array<{ domain: string; tenantId: string; error: string }>
  loadedAt: Date
}

/**
 * @deprecated Use SecretsConfigCache instead
 * Kept for backward compatibility during migration
 */
export type RuntimeConfigCache = SecretsConfigCache

/**
 * @deprecated Kept for backward compatibility during migration
 */
export interface LegacyRuntimeConfigCache {
  /** Plaintext variables loaded from DB */
  variables: Record<string, string>
  /** Decrypted secrets loaded from DB */
  secrets: Record<string, string>
  /** Metadata about the cache state */
  metadata: {
    loadedAt: Date | null
    entryCount: number
  }
}
