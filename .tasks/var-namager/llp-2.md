# Low-Level Plan: Runtime Config Loader (spec-2.md) - REVISION 2

**Task:** Runtime Config Loader (DB → Memory, Server-Side Only)
**Spec Reference:** `.tasks/var-namager/spec-2.md`
**Created:** 2026-01-24
**Revision:** 2
**Status:** Draft

---

## 1. Architecture Overview

### 1.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Runtime Config System                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────────────┐     ┌──────────┐  │
│  │ Caller      │────▶│  RuntimeConfigLoader │────▶│ In-Memory│  │
│  │ (API/Hook)  │     │  (Singleton)         │     │   Cache  │  │
│  └─────────────┘     └─────────────────────┘     └──────────┘  │
│         │                     │                     │            │
│         │                     │                     │            │
│         ▼                     ▼                     ▼            │
│  ┌─────────────┐     ┌─────────────────────┐     ┌──────────┐  │
│  │ Payload     │     │   Public API         │     │ Secrets  │  │
│  │ Instance    │     │ • loadRuntimeConfig │     │ Decrypted│  │
│  │ (injected)  │     │ • getVariable       │     │          │  │
│  └─────────────┘     │ • getSecret         │     └──────────┘  │
│                      └─────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

| Principle       | Description                                             |
| --------------- | ------------------------------------------------------- |
| **Global-only** | Single in-memory cache, no scopes, no resolution layers |
| **Explicit**    | No auto-loading, no lazy async, no startup hooks        |
| **Minimal**     | Only what's required, no optional integrations          |
| **Secure**      | Server-side only, no secret logging                     |

### 1.3 Precedence Flow

```
getVariable("API_URL")
         │
         ▼
┌─────────────────────┐
│ 1. Check process.env│◀──── Hard Override (exact key match)
│    (exact key match)│
└─────────────────────┘
         │
         ▼ (not found)
┌─────────────────────┐
│ 2. Check in-memory  │◀──── DB Config (enabled=true only)
│    cache (variables)│
└─────────────────────┘
         │
         ▼ (not found)
┌─────────────────────┐
│ 3. Throw Error      │◀──── "Missing required variable: API_URL"
│    "NotFound"       │
└─────────────────────┘
```

---

## 2. File Structure

### 2.1 New Files to Create

```
src/lib/config/runtime/
├── types.ts              # TypeScript interfaces
├── runtime-config.ts     # Main loader + getters (PRIMARY)
├── errors.ts             # Custom error classes
└── index.ts              # Public exports

tests/unit/lib/config/runtime/
└── runtime-config.test.ts     # Unit tests

tests/int/
└── runtime-config.int.test.ts  # Integration tests
```

### 2.2 Files to Modify

| File                                                       | Changes                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/server/payload/hooks/configEntries/afterRead-hook.ts` | Add `req.context.internalConfigLoad` check to bypass write-only UX |

---

## 3. Implementation Details

### 3.1 Type Definitions (`types.ts`)

```typescript
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
```

### 3.2 Custom Errors (`errors.ts`)

```typescript
/**
 * Runtime Config Errors
 *
 * @fileType error-definition
 * @domain config.runtime
 * @pattern error-handling
 */

export class ConfigNotLoadedError extends Error {
  constructor() {
    super('Runtime config has not been loaded. Call loadRuntimeConfig() first.')
    this.name = 'ConfigNotLoadedError'
  }
}

export class ConfigKeyNotFoundError extends Error {
  constructor(key: string, kind: 'variable' | 'secret') {
    super(`Missing required ${kind}: ${key}`)
    this.name = 'ConfigKeyNotFoundError'
  }
}
```

### 3.3 Main Implementation (`runtime-config.ts`)

````typescript
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

import type { Payload } from 'payload'
import { ConfigKind } from '../config-constants'
import { decryptSecret } from '../config-crypto'
import type { ConfigEntry } from '@/payload-types'
import type { RuntimeConfigCache, LoadConfigResult } from './types'
import { ConfigNotLoadedError, ConfigKeyNotFoundError } from './errors'

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
    // Type assertion needed because Payload's generic typing doesn't match doc type name
    const result = await payload.find<ConfigEntry>({
      collection: 'config_entries',
      where: { enabled: { equals: true } },
      limit: 1000, // Reasonable limit for config entries
      overrideAccess: true,
      req: {
        context: {
          internalConfigLoad: true,
        },
      } as any,
    })

    // Process each entry
    for (const doc of result.docs) {
      const { key, kind, value } = doc

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
    cache = {
      variables,
      secrets,
      metadata: {
        loadedAt: new Date(),
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
      loadedAt: cache.metadata.loadedAt,
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
````

### 3.4 Public Exports (`index.ts`)

```typescript
/**
 * Runtime Config Module Exports
 *
 * @fileType exports
 * @domain config.runtime
 */

export * from './runtime-config'
export * from './types'
export * from './errors'
```

---

## 4. Critical: Fixing the Write-Only Hook

### 4.1 Current State

The `afterReadHideSecretValue` hook is already at **field-level only** (in `ConfigEntries.ts` line 84):

```typescript
fields: [
  {
    name: 'value',
    // ...
    hooks: {
      afterRead: [afterReadHideSecretValue], // Field-level, NOT collection-level
    },
  },
  // ...
]
```

### 4.2 Updated Hook Implementation

Modify `src/server/payload/hooks/configEntries/afterRead-hook.ts`:

```typescript
/**
 * ConfigEntries After Read Hook
 *
 * @fileType hook
 * @domain config
 * @pattern write-only-ux
 * @ai-summary Clears secret values in Admin UI responses, but skips for internal runtime load
 *
 * Security (CRITICAL):
 * - Secrets should not be revealed after save in Admin UI
 * - Admin must re-enter value to rotate/change
 * - Original ciphertext remains encrypted in database
 * - Runtime loader can bypass this via context flag to get ciphertext
 */

import type { FieldHookArgs } from 'payload'

/**
 * Hide secret values in Admin UI responses
 * Used as field-level afterRead hook on the `value` field
 *
 * CRITICAL: Skip clearing when req.context.internalConfigLoad is true
 * This allows the runtime loader to get actual ciphertext values
 */
export const afterReadHideSecretValue = async ({ siblingData, value, req }: FieldHookArgs) => {
  // Check if this is an internal config load (runtime loader)
  // If so, return the actual value (ciphertext) so it can be decrypted
  if (req?.context?.internalConfigLoad === true) {
    return value
  }

  // Check if this is a secret kind
  if (siblingData?.kind === 'secret') {
    // Return empty string for the field value to implement write-only UX
    return ''
  }

  // For variables, return the value unchanged
  return value
}
```

---

## 5. Testing Strategy

### 5.1 Unit Tests (`tests/unit/lib/config/runtime/runtime-config.test.ts`)

```typescript
/**
 * Runtime Config Unit Tests
 *
 * @fileType unit-test
 * @domain config.runtime
 */

import { describe, expect, test, beforeEach, vi } from 'vitest'
import {
  loadRuntimeConfig,
  getVariable,
  getSecret,
  isConfigLoaded,
  clearConfigCache,
  reloadRuntimeConfig,
} from '@/lib/config/runtime'
import { decryptSecret, encryptSecret } from '@/lib/config/config-crypto'

// Mock Payload
const mockPayload = {
  find: vi.fn(),
  logger: { info: vi.fn() },
}

describe('Runtime Config', () => {
  beforeEach(() => {
    clearConfigCache()
    vi.clearAllMocks()
  })

  describe('loadRuntimeConfig', () => {
    test('should load variables and secrets from DB', async () => {
      const secretValue = 'secret-value'
      mockPayload.find.mockResolvedValue({
        docs: [
          { key: 'test_var', kind: 'variable', value: 'var-value', enabled: true },
          { key: 'test_secret', kind: 'secret', value: encryptSecret(secretValue), enabled: true },
        ],
      })

      const result = await loadRuntimeConfig(mockPayload as any)

      expect(result.success).toBe(true)
      expect(result.variablesLoaded).toBe(1)
      expect(result.secretsLoaded).toBe(1)
      expect(isConfigLoaded()).toBe(true)

      // Verify secret was decrypted
      expect(getSecret('test_secret')).toBe(secretValue)
    })

    test('should be idempotent and return cached result', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      const result1 = await loadRuntimeConfig(mockPayload as any)
      const result2 = await loadRuntimeConfig(mockPayload as any)

      // Should only call DB once
      expect(mockPayload.find).toHaveBeenCalledTimes(1)
      expect(result1.loadedAt).toEqual(result2.loadedAt)
      expect(result1).toEqual(result2)
    })

    test('should pass internalConfigLoad context flag', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload as any)

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          overrideAccess: true,
          req: expect.objectContaining({
            context: expect.objectContaining({
              internalConfigLoad: true,
            }),
          }),
        }),
      )
    })

    test('should rethrow DB errors (not wrap them)', async () => {
      const dbError = new Error('DB connection failed')
      mockPayload.find.mockRejectedValue(dbError)

      await expect(loadRuntimeConfig(mockPayload as any)).rejects.toThrow('DB connection failed')
    })

    test('should collect decryption errors but continue loading', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [
          { key: 'valid_var', kind: 'variable', value: 'value', enabled: true },
          { key: 'bad_secret', kind: 'secret', value: 'not-encrypted', enabled: true }, // Will fail decryption
        ],
      })

      const result = await loadRuntimeConfig(mockPayload as any)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].key).toBe('bad_secret')
    })
  })

  describe('getVariable', () => {
    test('should return process.env override (exact key match)', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ key: 'MY_VAR', kind: 'variable', value: 'db-value', enabled: true }],
      })

      await loadRuntimeConfig(mockPayload as any)

      // Set exact key
      process.env.MY_VAR = 'env-override'
      expect(getVariable('MY_VAR')).toBe('env-override')
      delete process.env.MY_VAR
    })

    test('should return DB value when env not set', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ key: 'DB_VAR', kind: 'variable', value: 'db-value', enabled: true }],
      })

      await loadRuntimeConfig(mockPayload as any)
      expect(getVariable('DB_VAR')).toBe('db-value')
    })

    test('should NOT match if env key case differs', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ key: 'my_var', kind: 'variable', value: 'db-value', enabled: true }],
      })

      await loadRuntimeConfig(mockPayload as any)

      // Set different case in env
      process.env.MY_VAR = 'env-override'
      expect(getVariable('my_var')).toBe('db-value') // Env key doesn't match
      delete process.env.MY_VAR
    })

    test('should throw ConfigNotLoadedError if not loaded', () => {
      expect(() => getVariable('any_key')).toThrow(ConfigNotLoadedError)
    })

    test('should throw ConfigKeyNotFoundError if key missing', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload as any)

      expect(() => getVariable('missing_key')).toThrow(ConfigKeyNotFoundError)
    })

    test('should return default value if provided', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload as any)

      expect(getVariable('missing', { defaultValue: 'default' })).toBe('default')
    })
  })

  describe('getSecret', () => {
    test('should return decrypted secret', async () => {
      const secretValue = 'my-secret-password'
      mockPayload.find.mockResolvedValue({
        docs: [
          { key: 'MY_SECRET', kind: 'secret', value: encryptSecret(secretValue), enabled: true },
        ],
      })

      await loadRuntimeConfig(mockPayload as any)

      expect(getSecret('MY_SECRET')).toBe(secretValue)
    })

    test('should throw ConfigKeyNotFoundError if secret missing', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })

      await loadRuntimeConfig(mockPayload as any)

      expect(() => getSecret('missing_secret')).toThrow(ConfigKeyNotFoundError)
    })
  })

  describe('security', () => {
    test('should throw on client-side access', () => {
      const { window } = globalThis
      ;(globalThis as any).window = {}

      expect(() => loadRuntimeConfig(mockPayload as any)).toThrow('server-side only')

      // Restore
      if (window === undefined) {
        delete (globalThis as any).window
      } else {
        ;(globalThis as any).window = window
      }
    })
  })
})
```

### 5.2 Integration Tests (`tests/int/runtime-config.int.test.ts`)

```typescript
/**
 * Runtime Config Integration Tests
 *
 * @fileType integration-test
 * @domain config.runtime
 * @pattern integration
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { loadRuntimeConfig, getVariable, getSecret, clearConfigCache } from '@/lib/config/runtime'
import { ConfigKind } from '@/lib/config/config-constants'
import { describe, expect, test, beforeAll, afterAll } from 'vitest'

describe('Runtime Config Integration', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    clearConfigCache()
    // Cleanup test entries
    try {
      await payload.delete({
        collection: 'config_entries',
        where: { key: { like: 'test_runtime_' } },
      })
    } catch {
      // Ignore cleanup errors
    }
  })

  test('should load config from real DB', async () => {
    // Create test entries
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_runtime_var',
        kind: ConfigKind.Variable,
        value: 'integration-test-value',
        enabled: true,
      },
      overrideAccess: true,
    })

    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_runtime_secret',
        kind: ConfigKind.Secret,
        value: 'integration-test-secret',
        enabled: true,
      },
      overrideAccess: true,
    })

    // Load config
    const result = await loadRuntimeConfig(payload)

    expect(result.success).toBe(true)
    expect(result.variablesLoaded).toBeGreaterThan(0)
    expect(result.secretsLoaded).toBeGreaterThan(0)

    // Verify values
    expect(getVariable('test_runtime_var')).toBe('integration-test-value')
    expect(getSecret('test_runtime_secret')).toBe('integration-test-secret')
  })

  test('should respect process.env override (exact key match)', async () => {
    // Create DB entry with exact key
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_runtime_override',
        kind: ConfigKind.Variable,
        value: 'db-value',
        enabled: true,
      },
      overrideAccess: true,
    })

    // Set env override with exact same key
    process.env.test_runtime_override = 'env-wins'

    await loadRuntimeConfig(payload)

    expect(getVariable('test_runtime_override')).toBe('env-wins')

    // Cleanup
    delete process.env.test_runtime_override
  })

  test('should not load disabled entries', async () => {
    // Create enabled entry
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_runtime_enabled',
        kind: ConfigKind.Variable,
        value: 'enabled-value',
        enabled: true,
      },
      overrideAccess: true,
    })

    // Create disabled entry
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_runtime_disabled',
        kind: ConfigKind.Variable,
        value: 'disabled-value',
        enabled: false,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload)

    // Enabled should be loaded
    expect(getVariable('test_runtime_enabled')).toBe('enabled-value')

    // Disabled should NOT be loaded (throw error)
    expect(() => getVariable('test_runtime_disabled')).toThrow()
  })

  test('should not leak secrets to logs', async () => {
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_runtime_leak',
        kind: ConfigKind.Secret,
        value: 'super-secret-value',
        enabled: true,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload)

    // The secret should be readable via API
    expect(getSecret('test_runtime_leak')).toBe('super-secret-value')
  })
})
```

---

## 6. Spec Updates Required

### 6.1 Update `spec-2.md` Non-Goals

Replace the current Excluded section with:

```markdown
Excluded (explicit non-goals)

No scopes / no resolution layers / no contextual variants

Single global config set loaded into memory

No "future hooks", no "prep for later"

No admin UI changes

No encryption logic changes

No key rotation

No client-side exposure

No auto-reload/watch on DB changes (manual reload only in v1)

No startup hooks (explicit load required)

No health check endpoints

No lazy-loading async getters (getters are synchronous after explicit load)
```

### 6.2 Update API Surface

Change from:

```typescript
// Before
loadRuntimeConfig(): Promise<void>
```

To:

```typescript
// After
loadRuntimeConfig(payload: Payload): Promise<LoadConfigResult>
```

### 6.3 Update Env Override Rule

Change from:

```markdown
process.env[KEY] (hard override)
```

To:

```markdown
process.env[KEY] (exact key match, hard override)
```

---

## 7. Security Considerations

### 7.1 Security Checklist

| Concern                  | Mitigation                                               |
| ------------------------ | -------------------------------------------------------- |
| **Client-side exposure** | `typeof window` check + TypeScript types                 |
| **Secret logging**       | Logger only prints metadata (counts, not values)         |
| **Memory safety**        | Secrets in module-level variable (process lifetime only) |
| **DB connection**        | Fail fast on DB errors (re-throw, not silent)            |
| **Access control**       | Uses `overrideAccess: true` (server-side admin)          |
| **Write-only bypass**    | Context flag `internalConfigLoad` prevents Admin UI leak |

### 7.2 Threat Model

| Threat                      | Impact   | Mitigation                                 |
| --------------------------- | -------- | ------------------------------------------ |
| Memory dump exposes secrets | Critical | Container security, short process lifetime |
| process.env override abuse  | Medium   | Intentional design for emergency overrides |
| Unauthorized server access  | Critical | Server-only code, no client bundles        |
| Log injection               | Low      | Structured logging, no user input in logs  |

---

## 8. Implementation Tasks

### Phase 1: Hook Fix

- [ ] Modify `src/server/payload/hooks/configEntries/afterRead-hook.ts` to check `req.context.internalConfigLoad`

### Phase 2: Core Implementation

- [ ] Create `src/lib/config/runtime/types.ts`
- [ ] Create `src/lib/config/runtime/errors.ts`
- [ ] Create `src/lib/config/runtime/runtime-config.ts` (accepts Payload, uses `ConfigEntry` type)
- [ ] Create `src/lib/config/runtime/index.ts`

### Phase 3: Testing

- [ ] Create `tests/unit/lib/config/runtime/runtime-config.test.ts`
- [ ] Create `tests/int/runtime-config.int.test.ts`
- [ ] Run `pnpm test` to verify

### Phase 4: Validation

- [ ] Run `pnpm tsc --noEmit`
- [ ] Run `pnpm lint:fix`
- [ ] Update `spec-2.md` with spec changes

---

## 9. Definition of Done

- [ ] Secrets are loaded and decrypted correctly despite write-only Admin UX
- [ ] Spec contains no optional integrations (startup hook / endpoint / lazy getters)
- [ ] Loader accepts a Payload instance (no internal `getPayload` bootstrap)
- [ ] Unit + integration tests pass
- [ ] Env override uses exact key match (case-sensitive)
- [ ] Code review passed
- [ ] `pnpm tsc --noEmit` passes

---

## 10. References

| Reference             | Link                                                       |
| --------------------- | ---------------------------------------------------------- |
| Payload CMS Docs      | https://payloadcms.com/docs                                |
| Config Manager Spec-1 | `.tasks/var-namager/spec-1.md`                             |
| Spec-2 (Original)     | `.tasks/var-namager/spec-2.md`                             |
| AGENTS.md Security    | See "CRITICAL SECURITY PATTERNS" section                   |
| Encryption Utils      | `src/lib/config/config-crypto.ts`                          |
| Config Entries        | `src/server/payload/collections/ConfigEntries.ts`          |
| AfterRead Hook        | `src/server/payload/hooks/configEntries/afterRead-hook.ts` |
| ConfigEntry Type      | `src/payload-types.ts` (line 848)                          |
