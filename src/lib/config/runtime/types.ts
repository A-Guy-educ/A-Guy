/**
 * Runtime Config Types
 *
 * @fileType type-definition
 * @domain config.runtime
 * @pattern types
 */

/**
 * Shape of the in-memory cache
 */
export interface RuntimeConfigCache {
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

/**
 * Result of loading config from DB
 */
export interface LoadConfigResult {
  success: boolean
  variablesLoaded: number
  secretsLoaded: number
  errors: Array<{ key: string; error: string }>
  loadedAt: Date
}

/**
 * Options for getVariable/getSecret
 */
export interface GetConfigOptions {
  /** Default value if key not found */
  defaultValue?: string
  /** Whether to throw if not found (default: true) */
  throwIfNotFound?: boolean
}
