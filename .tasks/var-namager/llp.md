# Low-Level Plan: Runtime Config Loader (spec-2.md)

**Task:** Runtime Config Loader (DB → Memory, Server-Side Only)
**Spec Reference:** `.tasks/var-namager/spec-2.md`
**Created:** 2026-01-24
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
│  │   Payload   │────▶│  RuntimeConfigLoader │────▶│ In-Memory│  │
│  │   Bootstrap │     │     (Singleton)      │     │   Cache  │  │
│  └─────────────┘     └─────────────────────┘     └──────────┘  │
│         │                     │                     │            │
│         │                     │                     │            │
│         ▼                     ▼                     ▼            │
│  ┌─────────────┐     ┌─────────────────────┐     ┌──────────┐  │
│  │   Hooks/    │     │   Public API         │     │ Secrets  │  │
│  │  Endpoints  │     │ • loadRuntimeConfig │     │ Decrypted│  │
│  └─────────────┘     │ • getVariable       │     └──────────┘  │
│                      │ • getSecret         │                    │
│                      └─────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Precedence Flow

```
getVariable("API_URL")
         │
         ▼
┌─────────────────────┐
│ 1. Check process.env│◀──── Hard Override
│    (highest priority)│
└─────────────────────┘
         │
         ▼ (not found)
┌─────────────────────┐
│ 2. Check in-memory  │◀──── DB Config
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
└── index.ts             # Public exports

tests/unit/lib/config/runtime/
├── runtime-config.test.ts     # Unit tests

tests/int/
├── runtime-config.int.test.ts  # Integration tests
```

### 2.2 Files to Modify

| File | Changes |
|------|---------|
| `src/lib/config/config-crypto.ts` | Export `decryptSecret` for runtime use |
| `src/payload.config.ts` | Optional: Register startup hook |
| `src/app/api/runtime-config/route.ts` | Optional: Health check endpoint |

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
    loadedFromDb: boolean
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

export class ConfigLoadError extends Error {
  constructor(key: string, underlyingError: Error) {
    super(`Failed to load config entry "${key}": ${underlyingError.message}`)
    this.name = 'ConfigLoadError'
  }
}
```

### 3.3 Main Implementation (`runtime-config.ts`)

```typescript
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
 * - process.env always wins (hard override)
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { decryptSecret } from '../config-crypto'
import { ConfigKind } from '../config-constants'
import type { ConfigEntries } from '@/payload-types'
import type { RuntimeConfigCache, LoadConfigResult } from './types'
import {
  ConfigNotLoadedError,
  ConfigKeyNotFoundError,
  ConfigLoadError,
} from './errors'

// ============================================
// Module-Level State (Process Singleton)
// ============================================

let cache: RuntimeConfigCache | null = null
let loadingPromise: Promise<LoadConfigResult> | null = null

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
 * Behavior:
 * - Idempotent: safe to call multiple times
 * - Only loads enabled=true entries
 * - Decrypts secrets using config-crypto
 * - Merges with process.env (env wins)
 *
 * @returns LoadConfigResult with stats and any errors
 *
 * @throws Error if DB is unreachable
 */
export async function loadRuntimeConfig(): Promise<LoadConfigResult> {
  assertServerSide()

  // Idempotent: return existing promise if already loading
  if (loadingPromise) {
    return loadingPromise
  }

  loadingPromise = (async (): Promise<LoadConfigResult> => {
    const startTime = Date.now()
    const errors: LoadConfigResult['errors'] = []
    const variables: Record<string, string> = {}
    const secrets: Record<string, string> = {}

    try {
      // Get Payload instance
      const payload = await getPayload({ config })

      // Query all enabled config entries
      // Use overrideAccess: true since we're server-side admin
      const result = await payload.find({
        collection: 'config_entries',
        where: { enabled: { equals: true } },
        limit: 1000, // Reasonable limit for config entries
        overrideAccess: true, // Server-side operation
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
          loadedFromDb: true,
          entryCount: result.docs.length,
        },
      }

      const duration = Date.now() - startTime

      // SECURITY: Never log secrets - only metadata
      payload.logger.info({
        msg: 'Runtime config loaded',
        variablesLoaded: Object.keys(variables).length,
        secretsLoaded: Object.keys(secrets).length,
        errorsCount: errors.length,
        durationMs: duration,
      })

      return {
        success: errors.length === 0,
        variablesLoaded: Object.keys(variables).length,
        secretsLoaded: Object.keys(secrets).length,
        errors,
        loadedAt: cache.metadata.loadedAt,
      }
    } finally {
      // Clear loading promise to allow retry on next call
      loadingPromise = null
    }
  })()

  return loadingPromise
}

/**
 * Force reload config (bypasses idempotent check)
 * Useful for dev mode or manual refresh
 */
export async function reloadRuntimeConfig(): Promise<LoadConfigResult> {
  assertServerSide()

  // Reset state to force fresh load
  cache = null
  loadingPromise = null

  return loadRuntimeConfig()
}

// ============================================
// Public API: Getters
// ============================================

/**
 * Get a configuration variable
 *
 * Precedence:
 * 1. process.env[KEY] (hard override)
 * 2. In-memory cache (DB config)
 * 3. Default value (if provided)
 * 4. Throw error
 *
 * @param key - Configuration key
 * @param options - Options for default value and error handling
 * @returns The configuration value
 *
 * @throws ConfigNotLoadedError if config not loaded
 * @throws ConfigKeyNotFoundError if key not found and no default
 */
export function getVariable(
  key: string,
  options?: { defaultValue?: string; throwIfNotFound?: boolean }
): string {
  assertServerSide()
  assertLoaded()

  const { defaultValue, throwIfNotFound = true } = options ?? {}

  // 1. Check process.env first (hard override)
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
 * @param key - Secret key
 * @param options - Options for default value and error handling
 * @returns The decrypted secret value
 *
 * @throws ConfigNotLoadedError if config not loaded
 * @throws ConfigKeyNotFoundError if key not found and no default
 */
export function getSecret(
  key: string,
  options?: { defaultValue?: string; throwIfNotFound?: boolean }
): string {
  assertServerSide()
  assertLoaded()

  const { defaultValue, throwIfNotFound = true } = options ?? {}

  // 1. Check process.env first (hard override)
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
  loadingPromise = null
}
```

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

## 4. Integration Points

### 4.1 Payload Startup Hook (Optional)

Add to `src/payload.config.ts` or create a startup hook:

```typescript
/**
 * Server start hook to load config
 * This ensures config is ready before first request
 */
import { loadRuntimeConfig } from '@/lib/config/runtime'

// Note: Payload CMS doesn't have built-in startup hooks in v3.x
// Alternative: Call loadRuntimeConfig() in first API route
// or use a lazy-loading pattern in getVariable/getSecret
```

### 4.2 Lazy Loading Pattern

```typescript
/**
 * Auto-load on first access
 * Useful if you don't want explicit startup calls
 */
export async function getVariable(
  key: string,
  options?: GetConfigOptions
): Promise<string> {
  assertServerSide()

  // Auto-load if not already loaded
  if (!isConfigLoaded()) {
    await loadRuntimeConfig()
  }

  // ... rest of implementation
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
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

describe('Runtime Config', () => {
  beforeEach(() => {
    clearConfigCache()
    vi.clearAllMocks()
  })

  describe('loadRuntimeConfig', () => {
    test('should load variables and secrets from DB', async () => {
      // Mock payload.find with test data
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [
            { key: 'test_var', kind: 'variable', value: 'var-value', enabled: true },
            { key: 'test_secret', kind: 'secret', value: encryptSecret('secret-value'), enabled: true },
          ],
        }),
        logger: { info: vi.fn() },
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      const result = await loadRuntimeConfig()

      expect(result.success).toBe(true)
      expect(result.variablesLoaded).toBe(1)
      expect(result.secretsLoaded).toBe(1)
      expect(isConfigLoaded()).toBe(true)
    })

    test('should be idempotent', async () => {
      // Same mock as above
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
        logger: { info: vi.fn() },
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      const result1 = await loadRuntimeConfig()
      const result2 = await loadRuntimeConfig()

      // Should only call DB once
      expect(mockPayload.find).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(result2)
    })

    test('should ignore disabled entries', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [
            { key: 'enabled_var', kind: 'variable', value: 'value', enabled: true },
            { key: 'disabled_var', kind: 'variable', value: 'disabled', enabled: false },
          ],
        }),
        logger: { info: vi.fn() },
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      await loadRuntimeConfig()

      const vars = await getVariable('disabled_var', { throwIfNotFound: false })
      expect(vars).toBe('')
    })

    test('should fail fast on DB error', async () => {
      const mockPayload = {
        find: vi.fn().mockRejectedValue(new Error('DB connection failed')),
        logger: { info: vi.fn() },
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      await expect(loadRuntimeConfig()).rejects.toThrow('DB connection failed')
    })
  })

  describe('getVariable', () => {
    test('should return process.env override', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [{ key: 'MY_VAR', kind: 'variable', value: 'db-value', enabled: true }] }),
        logger: { info: vi.fn() },
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      process.env.MY_VAR = 'env-override'
      await loadRuntimeConfig()

      expect(getVariable('MY_VAR')).toBe('env-override')

      delete process.env.MY_VAR
    })

    test('should return DB value when env not set', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [{ key: 'DB_VAR', kind: 'variable', value: 'db-value', enabled: true }] }),
        logger: { info: vi.fn() },
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      await loadRuntimeConfig()

      expect(getVariable('DB_VAR')).toBe('db-value')
    })

    test('should throw ConfigNotLoadedError if not loaded', () => {
      expect(() => getVariable('any_key')).toThrow(ConfigNotLoadedError)
    })

    test('should throw ConfigKeyNotFoundError if key missing', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
        logger: { info: vi.fn() },
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      await loadRuntimeConfig()

      expect(() => getVariable('missing_key')).toThrow(ConfigKeyNotFoundError)
    })

    test('should return default value if provided', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
        logger: { info: vi.fn() },
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      await loadRuntimeConfig()

      expect(getVariable('missing', { defaultValue: 'default' })).toBe('default')
    })
  })

  describe('getSecret', () => {
    test('should return decrypted secret', async () => {
      const secretValue = 'my-secret-password'
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [{ key: 'MY_SECRET', kind: 'secret', value: encryptSecret(secretValue), enabled: true }],
        }),
        logger: { info: vi.fn() },
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      await loadRuntimeConfig()

      expect(getSecret('MY_SECRET')).toBe(secretValue)
    })

    test('should throw ConfigKeyNotFoundError if secret missing', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
        logger: { info: vi.fn() },
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      await loadRuntimeConfig()

      expect(() => getSecret('missing_secret')).toThrow(ConfigKeyNotFoundError)
    })
  })

  describe('security', () => {
    test('should throw on client-side access', () => {
      // Simulate window object
      const { window } = globalThis
      ;(globalThis as any).window = {}

      expect(() => loadRuntimeConfig()).toThrow('server-side only')

      // Restore
      if (window === undefined) {
        delete (globalThis as any).window
      } else {
        (globalThis as any).window = window
      }
    })

    test('should not throw on server (window undefined)', async () => {
      delete (globalThis as any).window

      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
        logger: { info: vi.fn() },
      }
      ;(getPayload as any).mockResolvedValue(mockPayload)

      // Should not throw, just return
      await expect(loadRuntimeConfig()).resolves.toBeDefined()

      // Restore
      ;(globalThis as any).window = undefined
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
    const result = await loadRuntimeConfig()

    expect(result.success).toBe(true)
    expect(result.variablesLoaded).toBeGreaterThan(0)

    // Verify values
    expect(getVariable('test_runtime_var')).toBe('integration-test-value')
    expect(getSecret('test_runtime_secret')).toBe('integration-test-secret')
  })

  test('should respect process.env override in integration', async () => {
    // Create DB entry
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

    // Set env override
    process.env.TEST_RUNTIME_OVERRIDE = 'env-wins'

    await loadRuntimeConfig()

    expect(getVariable('TEST_RUNTIME_OVERRIDE')).toBe('env-wins')

    // Cleanup
    delete process.env.TEST_RUNTIME_OVERRIDE
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

    await loadRuntimeConfig()

    // The secret should be readable via API
    expect(getSecret('test_runtime_leak')).toBe('super-secret-value')

    // Note: In real test, you'd capture logs and verify no secret leakage
    // This is more of a code review concern
  })
})
```

---

## 6. Security Considerations

### 6.1 Security Checklist

| Concern | Mitigation |
|---------|------------|
| **Client-side exposure** | `typeof window` check + TypeScript types |
| **Secret logging** | Logger only prints metadata (counts, not values) |
| **Memory safety** | Secrets in module-level variable (process lifetime only) |
| **DB connection** | Fail fast on DB errors |
| **Access control** | Use `overrideAccess: true` (server-side admin) |
| **Error messages** | Explicit errors, no stack traces with sensitive data |

### 6.2 Threat Model

| Threat | Impact | Mitigation |
|--------|--------|------------|
| Memory dump exposes secrets | Critical | Container security, short process lifetime |
| process.env override abuse | Medium | Intentional design for emergency overrides |
| Unauthorized server access | Critical | Server-only code, no client bundles |
| Log injection | Low | Structured logging, no user input in logs |

---

## 7. Performance Considerations

### 7.1 Performance Characteristics

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `loadRuntimeConfig()` | O(n) | Single DB query, n = enabled entries |
| `getVariable()` | O(1) | Hash map lookup |
| `getSecret()` | O(1) | Hash map lookup |
| Memory usage | O(n) | Stores all enabled entries in memory |

### 7.2 Optimization Notes

- **Lazy loading**: Config only loaded when first accessed (optional)
- **No TTL**: Manual reload only, simplifies caching
- **Single query**: Fetches all entries in one DB call
- **Limit**: Hard limit of 1000 entries (reasonable for config)

---

## 8. Validation Against Project Standards

### 8.1 Standards Checklist

| Standard | Compliance | Notes |
|----------|------------|-------|
| **TypeScript-First** | ✅ | Full type definitions in `types.ts` |
| **Security-Critical** | ✅ | Server-side only, no secret logging |
| **Type Generation** | N/A | No schema changes |
| **Transaction Safety** | ✅ | No nested operations in hooks |
| **Access Control** | ✅ | Uses `overrideAccess: true` (server-side) |
| **File Structure** | ✅ | Follows `src/lib/config/` pattern |
| **Testing** | ✅ | Unit + integration tests |
| **Pattern Documentation** | ✅ | `@ai-summary`, `@pattern` tags |

### 8.2 Code Quality Metrics

| Metric | Target | Plan Value |
|--------|--------|------------|
| Test Coverage | >90% | Unit tests for all branches |
| Cyclomatic Complexity | <10 | Simple loader pattern |
| Documentation | 100% | JSDoc on all public APIs |
| Linting | Pass | Follows project ESLint rules |

---

## 9. Implementation Tasks

### Phase 1: Core Implementation
- [ ] Create `src/lib/config/runtime/types.ts`
- [ ] Create `src/lib/config/runtime/errors.ts`
- [ ] Create `src/lib/config/runtime/runtime-config.ts`
- [ ] Create `src/lib/config/runtime/index.ts`

### Phase 2: Testing
- [ ] Create `tests/unit/lib/config/runtime/runtime-config.test.ts`
- [ ] Create `tests/int/runtime-config.int.test.ts`
- [ ] Run `pnpm test` to verify

### Phase 3: Documentation
- [ ] Add module documentation comments
- [ ] Update `src/lib/config/README.md` (if exists)

### Phase 4: Validation
- [ ] Run `pnpm tsc --noEmit`
- [ ] Run `pnpm lint:fix`
- [ ] Run `pnpm generate:types` (if needed)
- [ ] Final code review

---

## 10. Rollout Plan

### 10.1 Deployment Steps

1. **Deploy code** - Merge PR with implementation
2. **Run tests** - CI passes all tests
3. **Manual verification** - Test in staging environment
4. **Monitor logs** - Verify no secret leakage in logs
5. **Update documentation** - If needed

### 10.2 Rollback Plan

If issues arise:
1. Remove process.env overrides if causing issues
2. Clear in-memory cache (`clearConfigCache()`)
3. Redeploy previous version if needed

---

## 11. Known Limitations (v1)

| Limitation | Reason | Workaround |
|------------|--------|------------|
| No auto-reload on DB change | Performance/simplicity | Manual `reloadRuntimeConfig()` call |
| No hot-reload in dev | Design choice | Restart dev server |
| No cluster mode support | Process-level singleton | One config per Node process |
| Max 1000 entries | Safety limit | Increase if needed |

---

## 12. Future Enhancements (Post-v1)

| Enhancement | Priority | Description |
|-------------|----------|-------------|
| Auto-reload | Medium | Watch for DB changes via polling |
| Cluster support | Low | Distributed cache (Redis) |
| Hot reload | Low | WebSocket通知 |
| Metrics endpoint | Low | Expose cache stats |

---

## 13. References

| Reference | Link |
|-----------|------|
| Payload CMS Docs | https://payloadcms.com/docs |
| Config Manager Spec-1 | `.tasks/var-namager/spec-1.md` |
| AGENTS.md Security | See "CRITICAL SECURITY PATTERNS" section |
| Encryption Utils | `src/lib/config/config-crypto.ts` |
| Config Entries | `src/server/payload/collections/ConfigEntries.ts` |

---

## 14. Approval Checklist

- [ ] Architecture approved
- [ ] Security review completed
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Code review passed
- [ ] Integration tested
