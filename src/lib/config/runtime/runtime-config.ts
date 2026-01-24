/**
 * Runtime Config Loader
 *
 * @fileType implementation
 * @domain config.runtime
 * @pattern singleton, in-memory-cache, config-loader
 * @ai-summary Server-side runtime config loader with DB→memory caching
 *
 * Security:
 * - Server-side only (throws on client)
 * - Secrets never logged
 * - Explicit error messages
 * - process.env exact key match (hard override)
 *
 * Design Constraints:
 * - Global-only: single in-memory cache, no scopes/contextual variants
 * - Explicit: must call loadRuntimeConfig() before using getters
 * - Minimal: no startup hooks, no health endpoints, no lazy loading
 */

import type { ConfigEntry } from '@/payload-types'
import type { Payload } from 'payload'
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
 * Load all enabled config entries from DB into memory
 *
 * Design:
 * - Dependency injection: caller provides Payload instance
 * - Idempotent: safe to call multiple times (uses existing cache)
 * - Only loads enabled=true entries
 * - Decrypts secrets using config-crypto
 * - Passes context flag to bypass write-only UX hook
 *
 * @param payload - Payload instance (must be initialized)
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
export async function loadRuntimeConfig(payload: Payload): Promise<LoadConfigResult> {
  assertServerSide()

  // Idempotent: return cached result if already loaded
  if (cache && lastLoadResult) {
    return lastLoadResult
  }

  const startTime = Date.now()
  const errors: LoadConfigResult['errors'] = []
  const variables: Record<string, string> = {}
  const secrets: Record<string, string> = {}

  try {
    // Query all enabled config entries with internal context flag
    // This bypasses the write-only UX hook so we get real ciphertext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (payload.find as any)({
      collection: 'config_entries',
      where: { enabled: { equals: true } },
      limit: 1000, // Reasonable limit for config entries
      overrideAccess: true,
      req: {
        context: {
          internalConfigLoad: true,
        },
      },
    })

    // Process each entry
    for (const doc of result.docs) {
      const { key, kind, value } = doc as ConfigEntry

      try {
        if (kind === ConfigKind.Variable) {
          // Variables: store as-is
          variables[key] = value
        } else if (kind === ConfigKind.Secret) {
          // Secrets: decrypt before storing
          if (value && value.length > 0) {
            secrets[key] = decryptSecret(value)
          }
        }
      } catch (error) {
        // Log error but continue loading other entries
        errors.push({
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Initialize cache
    const loadedAt = new Date()
    cache = {
      variables,
      secrets,
      metadata: {
        loadedAt,
        entryCount: result.docs.length,
      },
    }

    const duration = Date.now() - startTime

    // Store result for idempotent returns
    lastLoadResult = {
      success: errors.length === 0,
      variablesLoaded: Object.keys(variables).length,
      secretsLoaded: Object.keys(secrets).length,
      errors,
      loadedAt,
    }

    // SECURITY: Never log secrets - only metadata
    payload.logger.info({
      msg: 'Runtime config loaded',
      variablesLoaded: lastLoadResult.variablesLoaded,
      secretsLoaded: lastLoadResult.secretsLoaded,
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
// Public API: Getters (Synchronous)
// ============================================

/**
 * Get a configuration variable
 *
 * Precedence (exact key match):
 * 1. process.env[KEY] (hard override)
 * 2. In-memory cache (DB config)
 * 3. Default value (if provided)
 * 4. Throw error
 *
 * @param key - Configuration key (exact match required)
 * @param options - Options for default value and error handling
 * @returns The configuration value
 *
 * @throws ConfigNotLoadedError if config not loaded
 * @throws ConfigKeyNotFoundError if key not found and no default
 */
export function getVariable(
  key: string,
  options?: { defaultValue?: string; throwIfNotFound?: boolean },
): string {
  assertServerSide()
  assertLoaded()

  const { defaultValue, throwIfNotFound = true } = options ?? {}

  // 1. Check process.env first (exact key match)
  if (process.env[key] !== undefined) {
    return process.env[key]!
  }

  // 2. Check in-memory cache
  if (cache!.variables[key] !== undefined) {
    return cache!.variables[key]
  }

  // 3. Return default or throw
  if (defaultValue !== undefined) {
    return defaultValue
  }

  if (!throwIfNotFound) {
    return ''
  }

  throw new ConfigKeyNotFoundError(key, 'variable')
}

/**
 * Get a configuration secret
 *
 * Same precedence as getVariable, but for secrets.
 * Secrets are decrypted and stored in memory after load.
 *
 * SECURITY:
 * - Never logs the secret value
 * - Throws explicit error if not found
 *
 * @param key - Secret key (exact match required)
 * @param options - Options for default value and error handling
 * @returns The decrypted secret value
 *
 * @throws ConfigNotLoadedError if config not loaded
 * @throws ConfigKeyNotFoundError if key not found and no default
 */
export function getSecret(
  key: string,
  options?: { defaultValue?: string; throwIfNotFound?: boolean },
): string {
  assertServerSide()
  assertLoaded()

  const { defaultValue, throwIfNotFound = true } = options ?? {}

  // 1. Check process.env first (exact key match)
  if (process.env[key] !== undefined) {
    return process.env[key]!
  }

  // 2. Check in-memory cache (secrets)
  if (cache!.secrets[key] !== undefined) {
    return cache!.secrets[key]
  }

  // 3. Return default or throw
  if (defaultValue !== undefined) {
    return defaultValue
  }

  if (!throwIfNotFound) {
    return ''
  }

  throw new ConfigKeyNotFoundError(key, 'secret')
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
} | null {
  if (!cache) {
    return null
  }

  return {
    loadedAt: cache.metadata.loadedAt,
    entryCount: cache.metadata.entryCount,
    variableCount: Object.keys(cache.variables).length,
    secretCount: Object.keys(cache.secrets).length,
  }
}

/**
 * Get all variable keys (for introspection)
 */
export function getVariableKeys(): string[] {
  assertServerSide()
  assertLoaded()
  return Object.keys(cache!.variables)
}

/**
 * Get all secret keys (for introspection, not values)
 */
export function getSecretKeys(): string[] {
  assertServerSide()
  assertLoaded()
  return Object.keys(cache!.secrets)
}

/**
 * Clear the in-memory cache
 * Useful for testing or graceful shutdown
 */
export function clearConfigCache(): void {
  cache = null
  lastLoadResult = null
}
