/**
 * Runtime Config Types
 *
 * @fileType type-definition
 * @domain config.runtime
 * @pattern types
 */

/**
 * Shape of the in-memory cache (tenant-scoped)
 * Keys are prefixed with tenant context to avoid collisions
 */
export interface RuntimeConfigCache {
  /** Tenant-scoped plaintext variables: Map<tenantId, Map<key, value>> */
  variables: Map<string, Map<string, string>>
  /** Tenant-scoped decrypted secrets: Map<tenantId, Map<key, value>> */
  secrets: Map<string, Map<string, string>>
  /** Metadata about the cache state */
  metadata: {
    loadedAt: Date | null
    entryCount: number
    tenantsLoaded: number
  }
}

/**
 * Result of loading tenant-scoped config
 */
export interface LoadConfigResult {
  success: boolean
  variablesLoaded: number
  secretsLoaded: number
  errors: Array<{ key: string; tenantId: string; error: string }>
  loadedAt: Date
}

/**
 * @deprecated Kept for backward compatibility during migration
 * Use RuntimeConfigCache (tenant-scoped) instead
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
