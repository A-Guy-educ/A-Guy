
---

# Task: Tenant-Scoped ConfigEntries

## Goal

Make `ConfigEntries` tenant-aware by linking each entry to the existing `tenants` collection, enforcing uniqueness per tenant, and updating runtime access patterns to require tenant context.

## Scope

* Add `tenant` relationship field to `ConfigEntries`
* Enforce uniqueness on (`tenant`, `key`)
* Update admin UX defaults and filtering
* Update tests accordingly
* **Do not** change encryption/audit logic beyond adding tenant metadata

## Non-Goals

* No global fallback (no “global config” tier) in v1
* No per-tenant caching/loader architecture changes beyond requiring tenant context
* No multi-tenant resolution across scopes (only tenant+key)

---

## Data Model Changes

### `ConfigEntries`

Add field:

* `tenant` (relationship → `tenants`, required, indexed)

Constraints:

* Unique constraint: (`tenant`, `key`)

  * Implement via DB index if supported, otherwise enforce in `beforeChange` hook (must be deterministic and fail loudly)

Admin UX:

* DefaultColumns: add `tenant`
* Filters: allow filtering by `tenant`
* Create/Edit: `tenant` required
* Optional: auto-default tenant to `DEFAULT_TENANT_SLUG` (env) **only** if your admin flow expects a default; otherwise force explicit selection

### `ConfigAuditLogs`

Add fields (metadata only):

* `tenant` (relationship → `tenants`, required)
* Keep audit append-only, and never store secret values

---

## Behavior Changes

### Access API (server-side)

Update any getters to require tenant context:

* `getVariable(tenantId, key)`
* `getSecret(tenantId, key)`

Rules:

* Throw if tenantId missing
* Env override still allowed, but must be tenant-safe:

  * Convention: `TENANT_<TENANTSLUG>__<KEY>` or `TENANT_<TENANTID>__<KEY>`
  * If you don’t want this complexity, disable env override for tenant-scoped config in v1 and rely only on DB.

---

## Hooks Updates

### Uniqueness Enforcement

On create/update:

* Ensure no other doc exists with same `tenant` + `key`
* On update, ignore current doc id

### Audit Logging

* When writing audit log, store `tenant` from the mutated doc

---

## Tests Updates

### Integration

* Can create same `key` under two different tenants (should succeed)
* Cannot create duplicate (`tenant`, `key`) (should fail)
* Updates that omit `key` still work (immutability check remains correct)
* Audit entries include correct tenant
* Secrets remain encrypted at rest and write-only UX still holds

### Required Test Setup

* Ensure test harness creates or finds 2 tenant docs
* Use those tenant ids in create/update calls

---

## Acceptance Criteria

* Every `ConfigEntries` doc is linked to exactly one tenant
* Duplicate key per tenant is blocked
* Same key across different tenants is allowed
* Audit logs include tenant metadata
* Tests pass in CI

---

## Recommended Docs to Prepare

* **Low risk** change but impacts data integrity → you need a short **High-Level Spec** only (1 page) + this task.
  No PRD needed.

---

# Low-Level Plan: Tenant-Scoped ConfigEntries (Spec-3)

## Overview

Transform `ConfigEntries` from a global key-value store to a tenant-scoped store where each entry belongs to exactly one tenant. This requires changes to data model, hooks, runtime API, and tests.

## Decision: Env Override Disabled for Tenant-Scoped Config

Per spec-3, we choose **simple approach**: disable `process.env` override for tenant-scoped config entries. This simplifies implementation and avoids naming convention complexity.

---

## Phase 1: Data Model Changes

### 1.1 Update `ConfigEntries` Collection

**File:** [`src/server/payload/collections/ConfigEntries.ts`](src/server/payload/collections/ConfigEntries.ts)

```typescript
// Add tenant field to fields array (after 'enabled')
{
  name: 'tenant',
  type: 'relationship',
  relationTo: 'tenants',
  required: true,
  index: true,
  admin: {
    description: 'Tenant this config entry belongs to',
    position: 'sidebar',
  },
}

// Update admin defaults
defaultColumns: ['key', 'tenant', 'kind', 'enabled', 'updatedAt'],

// Remove unique constraint from 'key' (line 44)
unique: true,  // REMOVE - will be (tenant, key) uniqueness
```

### 1.2 Update `ConfigAuditLogs` Collection

**File:** [`src/server/payload/collections/ConfigAuditLogs.ts`](src/server/payload/collections/ConfigAuditLogs.ts)

```typescript
// Add tenant field to fields array (after 'reason')
{
  name: 'tenant',
  type: 'relationship',
  relationTo: 'tenants',
  required: true,
  admin: {
    description: 'Tenant of the mutated config entry',
  },
}

// Add to defaultColumns
defaultColumns: ['key', 'tenant', 'kind', 'action', 'actor', 'createdAt'],
```

---

## Phase 2: Hook Changes

### 2.1 BeforeChange Hook - Tenant Uniqueness Validation

**File:** [`src/server/payload/hooks/configEntries/beforeChange-hook.ts`](src/server/payload/hooks/configEntries/beforeChange-hook.ts)

**New validation logic (after existing key/kind immutability checks):**

```typescript
// =========================================================================
// Tenant+Key Uniqueness Check
// CRITICAL: Must be deterministic and fail loudly
// =========================================================================
async function checkTenantKeyUniqueness({
  data,
  operation,
  req,
  originalDoc,
}: {
  data: ConfigEntriesFields
  operation: 'create' | 'update'
  req: { payload: Payload }
  originalDoc?: { id: string; tenant: string | object }
}): Promise<void> {
  const tenantId = typeof data.tenant === 'object' ? data.tenant.id : data.tenant

  if (!tenantId) {
    throw new Error('Tenant is required for config entries')
  }

  // Build query to find conflicting entry
  const whereQuery: Where = {
    and: [{ tenant: { equals: tenantId } }, { key: { equals: data.key } }],
  }

  // On update, exclude current document
  if (operation === 'update' && originalDoc?.id) {
    whereQuery.and.push({
      id: { not_equals: originalDoc.id },
    } as any)
  }

  const existing = await req.payload.find({
    collection: 'config_entries',
    where: whereQuery,
    limit: 1,
    req, // Pass req for potential transaction safety
    overrideAccess: true, // Bypass access control for validation
  })

  if (existing.docs.length > 0) {
    throw new Error(
      `Config key "${data.key}" already exists for this tenant. ` +
        `Each tenant can have only one entry per key.`,
    )
  }
}

// Call in beforeChange hook:
if (operation === 'create' || operation === 'update') {
  await checkTenantKeyUniqueness({ data, operation, req, originalDoc })
}
```

### 2.2 AfterChange Hook - Tenant in Audit Log

**File:** [`src/server/payload/hooks/configEntries/afterChange-hook.ts`](src/server/payload/hooks/configEntries/afterChange-hook.ts)

**Update audit log creation:**

```typescript
// Get tenant ID from doc
const tenantId = doc.tenant && typeof doc.tenant === 'object'
  ? doc.tenant.id
  : (doc.tenant as string)

// Update payload.create to include tenant:
data: {
  key: doc.key,
  kind: doc.kind,
  action: action,
  actor: actorId,
  tenant: tenantId, // NEW
}
```

---

## Phase 3: Runtime API Changes

### 3.1 Update Types

**File:** [`src/lib/config/runtime/types.ts`](src/lib/config/runtime/types.ts)

```typescript
/**
 * Tenant-scoped in-memory cache
 * Keys are prefixed with tenant context to avoid collisions
 */
export interface TenantScopedConfigCache {
  // Map<tenantId, Map<key, value>>
  variables: Map<string, Map<string, string>>
  secrets: Map<string, Map<string, string>>
  metadata: {
    loadedAt: Date | null
    entryCount: number
    tenantsLoaded: number
  }
}

/**
 * Result of loading tenant-scoped config
 */
export interface LoadTenantConfigResult {
  success: boolean
  variablesLoaded: number
  secretsLoaded: number
  errors: Array<{ key: string; tenantId: string; error: string }>
  loadedAt: Date
}
```

### 3.2 Update Runtime Config Loader

**File:** [`src/lib/config/runtime/runtime-config.ts`](src/lib/config/runtime/runtime-config.ts)

**Changes to `loadRuntimeConfig`:**

```typescript
// Cache structure changes from Record<string, string> to Map<string, Map<string, string>>
let cache: TenantScopedConfigCache | null = null

export async function loadRuntimeConfig(
  payload: Payload,
  tenantId?: string,  // Optional: load specific tenant, or all
): Promise<LoadTenantConfigResult> {
  // ... existing server-side check ...

  const errors: LoadTenantConfigResult['errors'] = []
  const variables = new Map<string, Map<string, string>>()
  const secrets = new Map<string, Map<string, string>>()

  try {
    // Build query - optional tenant filter
    const where: Where = { enabled: { equals: true } }
    if (tenantId) {
      where.tenant = { equals: tenantId }
    }

    const result = await (payload.find as any)({
      collection: 'config_entries',
      where,
      limit: 1000,
      overrideAccess: true,
      req: { context: { internalConfigLoad: true } },
    })

    for (const doc of result.docs) {
      const { key, kind, value, tenant } = doc as ConfigEntry
      const tId = typeof tenant === 'object' ? tenant.id : tenant

      if (!tId) continue

      if (!variables.has(tId)) {
        variables.set(tId, new Map())
        secrets.set(tId, new Map())
      }

      try {
        if (kind === ConfigKind.Variable) {
          variables.get(tId)!.set(key, value)
        } else if (kind === ConfigKind.Secret && value?.length > 0) {
          secrets.get(tId)!.set(key, decryptSecret(value))
        }
      } catch (error) {
        errors.push({ key, tenantId: tId, error: error instanceof Error ? error.message : 'Unknown' })
      }
    }

    // Update cache structure
    cache = { variables, secrets, metadata: { loadedAt: new Date(), entryCount: result.docs.length, tenantsLoaded: variables.size } }

    return { success: errors.length === 0, variablesLoaded: ..., secretsLoaded: ..., errors, loadedAt: new Date() }
  } catch (error) {
    throw error
  }
}
```

### 3.3 Update Getter Functions - Tenant-Scoped

**File:** [`src/lib/config/runtime/runtime-config.ts`](src/lib/config/runtime/runtime-config.ts)

**New function signatures:**

```typescript
/**
 * Get a configuration variable for a specific tenant
 *
 * @param tenantId - Tenant ID to scope the lookup
 * @param key - Configuration key
 * @param options - Default value and error handling options
 * @returns The configuration value
 *
 * @throws ConfigNotLoadedError if config not loaded
 * @throws ConfigKeyNotFoundError if key not found and no default
 */
export function getVariable(
  tenantId: string,
  key: string,
  options?: { defaultValue?: string; throwIfNotFound?: boolean },
): string

/**
 * Get a secret for a specific tenant
 */
export function getSecret(
  tenantId: string,
  key: string,
  options?: { defaultValue?: string; throwIfNotFound?: boolean },
): string
```

**Implementation pattern:**

```typescript
export function getVariable(
  tenantId: string,
  key: string,
  options?: { defaultValue?: string; throwIfNotFound?: boolean },
): string {
  assertServerSide()
  assertLoaded()

  const { defaultValue, throwIfNotFound = true } = options ?? {}

  // Note: process.env override DISABLED for tenant-scoped config
  // (per spec-3 decision)

  // Check tenant-specific cache
  const tenantVariables = cache?.variables.get(tenantId)
  if (tenantVariables?.has(key)) {
    return tenantVariables.get(key)!
  }

  // Default or throw
  if (defaultValue !== undefined) return defaultValue
  if (!throwIfNotFound) return ''

  throw new ConfigKeyNotFoundError(key, 'variable', tenantId)
}
```

### 3.4 Add Context Helper

**File:** [`src/lib/config/runtime/runtime-config.ts`](src/lib/config/runtime/runtime-config.ts)

```typescript
/**
 * Get all keys for a tenant (for introspection)
 */
export function getVariableKeys(tenantId: string): string[] {
  assertServerSide()
  assertLoaded()
  return cache?.variables.get(tenantId) ? Array.from(cache!.variables.get(tenantId)!.keys()) : []
}

export function getSecretKeys(tenantId: string): string[] {
  assertServerSide()
  assertLoaded()
  return cache?.secrets.get(tenantId) ? Array.from(cache!.secrets.get(tenantId)!.keys()) : []
}

/**
 * Get all loaded tenant IDs
 */
export function getLoadedTenantIds(): string[] {
  return cache ? Array.from(cache.variables.keys()) : []
}
```

---

## Phase 4: Test Updates

### 4.1 Test Fixtures

**Pattern:** Create two tenant fixtures at test setup.

```typescript
// In beforeAll, create test tenants:
let tenant1: { id: string }
let tenant2: { id: string }

// Create or find tenant 1
const tenants1 = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: 'test-tenant-1' } },
})
if (tenants1.docs.length > 0) {
  tenant1 = tenants1.docs[0]
} else {
  tenant1 = await payload.create({
    collection: 'tenants',
    data: { name: 'Test Tenant 1', slug: 'test-tenant-1' },
    overrideAccess: true,
  })
}

// Similar for tenant2 with slug 'test-tenant-2'
```

### 4.2 Updated Test Cases

**File:** [`tests/int/config-manager.int.test.ts`](tests/int/config-manager.int.test.ts)

```typescript
describe('ConfigEntries Collection (Tenant-Scoped)', () => {
  let tenant1: { id: string }
  let tenant2: { id: string }

  beforeAll(async () => {
    // Setup tenants (as above)
  })

  test('should create same key under two different tenants', async () => {
    const result1 = await payload.create({
      collection: 'config_entries',
      data: {
        key: 'shared_key',
        kind: ConfigKind.Variable,
        value: 'tenant-1-value',
        enabled: true,
        tenant: tenant1.id,
      },
      req: { user: adminUser } as any,
    })

    const result2 = await payload.create({
      collection: 'config_entries',
      data: {
        key: 'shared_key',
        kind: ConfigKind.Variable,
        value: 'tenant-2-value',
        enabled: true,
        tenant: tenant2.id,
      },
      req: { user: adminUser } as any,
    })

    expect(result1.id).not.toBe(result2.id)
    expect(result1.tenant).toBe(tenant1.id)
    expect(result2.tenant).toBe(tenant2.id)
  })

  test('should reject duplicate (tenant, key) combination', async () => {
    // Create first entry
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'unique_key',
        kind: ConfigKind.Variable,
        value: 'value',
        enabled: true,
        tenant: tenant1.id,
      },
      req: { user: adminUser } as any,
    })

    // Try to create duplicate in same tenant
    await expect(
      payload.create({
        collection: 'config_entries',
        data: {
          key: 'unique_key', // Same key
          kind: ConfigKind.Variable,
          value: 'value',
          enabled: true,
          tenant: tenant1.id, // Same tenant
        },
        req: { user: adminUser } as any,
      }),
    ).rejects.toThrow(/already exists for this tenant/)
  })

  test('audit log includes tenant', async () => {
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'test_audit_tenant',
        kind: ConfigKind.Variable,
        value: 'value',
        enabled: true,
        tenant: tenant1.id,
      },
      req: { user: adminUser } as any,
    })

    const logs = await payload.find({
      collection: 'config_audit_logs',
      where: { key: { equals: 'test_audit_tenant' } },
      sort: '-createdAt',
      limit: 1,
    })

    expect(logs.docs.length).toBeGreaterThan(0)
    expect(logs.docs[0].tenant).toBe(tenant1.id)
  })
})

describe('Runtime Config (Tenant-Scoped)', () => {
  test('should load tenant-scoped config', async () => {
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'runtime_tenant_var',
        kind: ConfigKind.Variable,
        value: 'runtime-value',
        enabled: true,
        tenant: tenant1.id,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload) // Loads all tenants

    expect(getVariable(tenant1.id, 'runtime_tenant_var')).toBe('runtime-value')
  })

  test('should not find tenant-2 config from tenant-1', async () => {
    await payload.create({
      collection: 'config_entries',
      data: {
        key: 'isolated_key',
        kind: ConfigKind.Variable,
        value: 'tenant-2-only',
        enabled: true,
        tenant: tenant2.id,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload)

    expect(() => getVariable(tenant1.id, 'isolated_key')).toThrow(ConfigKeyNotFoundError)
  })

  test('should throw if tenantId missing from getter', async () => {
    // Old API should fail
    expect(() => getVariable('old_key')).toThrow()
  })
})
```

### 4.3 Cleanup in afterAll

```typescript
afterAll(async () => {
  // Cleanup test data with tenant filter
  await payload.delete({
    collection: 'config_entries',
    where: {
      and: [{ key: { like: 'test_' } }, { tenant: { in: [tenant1.id, tenant2.id] } }],
    },
  })
  // ... existing cleanup
})
```

---

## Phase 5: Type Generation

### 5.1 Run Type Generation

```bash
pnpm generate:types
```

**Expected changes in `payload-types.ts`:**

```typescript
export interface ConfigEntries {
  id: string
  tenant: Tenant
  key: string
  kind: 'variable' | 'secret'
  value: string
  enabled: boolean
  updatedAt: string
  createdAt: string
}

export interface ConfigAuditLogs {
  id: string
  key: string
  tenant: Tenant
  kind: 'variable' | 'secret'
  action: 'created' | 'updated' | 'enabled' | 'disabled'
  actor: User
  reason?: string
  createdAt: string
}
```

---

## Phase 6: Import Map Generation

```bash
pnpm generate:importmap
```

---

## Validation Checklist

* [ ] `ConfigEntries` has `tenant` relationship (required, indexed)
* [ ] `ConfigAuditLogs` has `tenant` relationship (required)
* [ ] Unique constraint enforced on (`tenant`, `key`) via `beforeChange` hook
* [ ] Admin UI shows `tenant` column in list view
* [ ] Admin UI requires tenant selection on create/edit
* [ ] Audit logs include correct tenant metadata
* [ ] `getVariable(tenantId, key)` throws if tenantId missing
* [ ] `getSecret(tenantId, key)` throws if tenantId missing
* [ ] Same key can exist under different tenants
* [ ] Duplicate (tenant, key) is blocked
* [ ] Tests pass in CI
* [ ] TypeScript compiles without errors
* [ ] Import map regenerated

---

## Risk Assessment

| Risk                                     | Severity | Mitigation                                     |
| ---------------------------------------- | -------- | ---------------------------------------------- |
| Breaking changes to existing runtime API | High     | Deprecation warning pattern, gradual migration |
| Data migration for existing entries      | Medium   | Add migration script to set default tenant     |
| Query performance with tenant filter     | Low      | Tenant field is indexed                        |
| Transaction safety in uniqueness check   | Medium   | Use unique index in DB as backup               |

---

## Migration Strategy (Production)

For existing deployments, a migration script is needed:

```typescript
// scripts/migrate-config-entries-to-tenant.ts
// 1. Find DEFAULT_TENANT_SLUG env
// 2. Get default tenant ID
// 3. Update all existing ConfigEntries without tenant to default tenant
// 4. Run uniqueness validation
```

**This migration is OUT OF SCOPE for this implementation plan but should be noted.**

---

## Files Modified Summary

| File                                                          | Change Type                       |
| ------------------------------------------------------------- | --------------------------------- |
| `src/server/payload/collections/ConfigEntries.ts`             | Add tenant field, update admin    |
| `src/server/payload/collections/ConfigAuditLogs.ts`           | Add tenant field                  |
| `src/server/payload/hooks/configEntries/beforeChange-hook.ts` | Uniqueness validation             |
| `src/server/payload/hooks/configEntries/afterChange-hook.ts`  | Audit tenant inclusion            |
| `src/lib/config/runtime/types.ts`                             | New types for tenant-scoped cache |
| `src/lib/config/runtime/runtime-config.ts`                    | New API, cache restructuring      |
| `tests/int/config-manager.int.test.ts`                        | Tenant-scoped tests               |
| `tests/int/runtime-config.int.test.ts`                        | Tenant-scoped runtime tests       |
| `payload-types.ts`                                            | Auto-generated                    |

---

## Dependencies

* `Tenants` collection must exist (already implemented)
* No new npm dependencies required
* No external service changes required

---
