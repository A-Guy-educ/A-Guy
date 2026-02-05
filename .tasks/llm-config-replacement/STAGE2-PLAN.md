# Stage 2: ConfigEntries → ConfigSecrets

## Overview

Transform `configEntries` collection into a **secrets-only** collection called `configSecrets`.

**Key Change**: All entries are secrets. No more "kind" field distinguishing between Variable/Secret/SystemParam.

- Non-secret configuration → **ConfigValues** (already implemented in Stage 1)
- Secrets → **ConfigSecrets** (this stage)

---

## Current State Analysis

### Files to Modify

| File                                                          | Current Purpose                                          | Changes Needed                                                        |
| ------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/server/payload/collections/ConfigEntries.ts`             | Collection with kind field (Variable/Secret/SystemParam) | Rename to ConfigSecrets.ts, remove kind field, always encrypt         |
| `src/infra/config/config-constants.ts`                        | Contains ConfigKind enum                                 | Remove ConfigKind, remove looksLikeSecret, remove SECRET_KEY_PATTERNS |
| `src/server/payload/hooks/configEntries/beforeChange-hook.ts` | Encrypts only secrets, validates kind                    | Always encrypt, remove kind logic                                     |
| `src/server/payload/hooks/configEntries/afterRead-hook.ts`    | Hides value only for secrets                             | Always hide value (write-only for all)                                |
| `src/server/payload/hooks/configEntries/afterChange-hook.ts`  | Audit log with kind field                                | Remove kind from audit log                                            |
| `src/infra/config/runtime/runtime-config.ts`                  | Loads variables + secrets separately                     | Remove variables logic, secrets only                                  |
| `src/infra/config/runtime/types.ts`                           | Cache types with variables/secrets                       | Update for secrets-only                                               |
| `tests/int/config-manager.int.test.ts`                        | Tests Variable/Secret/SystemParam                        | Update for secrets-only                                               |
| `src/payload.config.ts`                                       | Imports ConfigEntries                                    | Update import                                                         |

### Hook Directory Rename

```
src/server/payload/hooks/configEntries/  →  src/server/payload/hooks/configSecrets/
```

---

## Implementation Steps

### Step 1: Update config-constants.ts

**Remove:**

- `ConfigKind` enum
- `SECRET_KEY_PATTERNS` array
- `looksLikeSecret()` function

**Keep:**

- `ConfigDomain` (for ConfigValues)
- `ConfigAction` (for audit logs)
- `isSnakeCase()` (for key validation)

```typescript
// REMOVE these:
export const ConfigKind = { ... }
export type ConfigKind = ...
export const SECRET_KEY_PATTERNS = [...]
export function looksLikeSecret(key: string): boolean { ... }

// KEEP these:
export const ConfigDomain = { ... }
export const ConfigAction = { ... }
export function isSnakeCase(key: string): boolean { ... }
```

---

### Step 2: Rename Collection File

Rename:

```
src/server/payload/collections/ConfigEntries.ts → ConfigSecrets.ts
```

Update collection:

```typescript
// ConfigSecrets.ts
export const ConfigSecrets: CollectionConfig = {
  slug: 'config_secrets',  // Changed from 'config_entries'
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'title', 'tenant', 'enabled', 'updatedAt'],  // Remove 'kind'
    group: 'System',
    description: 'Tenant-scoped encrypted secrets. All values are always encrypted.',
  },
  access: { ... },  // Keep admin-only access
  fields: [
    { name: 'key', ... },      // Keep
    { name: 'tenant', ... },   // Keep
    // REMOVE: { name: 'kind', ... }
    { name: 'title', ... },    // Keep
    { name: 'value', ... },    // Keep (always encrypted now)
    { name: 'enabled', ... },  // Keep
  ],
  hooks: { ... },
}
```

---

### Step 3: Update beforeChange-hook.ts

**Remove:**

- Kind immutability check
- Secret-like key warning (no variables anymore)
- Conditional encryption based on kind

**Always encrypt value:**

```typescript
// BEFORE
if (data.kind === ConfigKind.Secret && data.value) {
  data.value = encryptSecret(data.value)
}

// AFTER
if (data.value) {
  data.value = encryptSecret(data.value)
}
```

Update collection reference:

```typescript
// BEFORE
collection: 'config_entries'

// AFTER
collection: 'config_secrets'
```

---

### Step 4: Update afterRead-hook.ts

**Remove:**

- Kind check (always hide value now)

```typescript
// BEFORE
if (siblingData?.kind === 'secret') {
  return ''
}
return value

// AFTER
// Always hide value (unless internal config load)
if (req?.context?.internalConfigLoad === true) {
  return value // Return ciphertext for runtime loader
}
return '' // Always write-only for admin UI
```

---

### Step 5: Update afterChange-hook.ts

**Remove:**

- `kind` field from audit log creation

```typescript
// BEFORE
data: {
  key: doc.key,
  kind: doc.kind,  // REMOVE
  action: action,
  actor: actorId,
  tenant: tenantId,
}

// AFTER
data: {
  key: doc.key,
  action: action,
  actor: actorId,
  tenant: tenantId,
}
```

---

### Step 6: Update ConfigAuditLogs Collection

**Remove** the `kind` field from the audit logs collection as well.

File: `src/server/payload/collections/ConfigAuditLogs.ts`

---

### Step 7: Rename Hook Directory

```bash
mv src/server/payload/hooks/configEntries src/server/payload/hooks/configSecrets
```

Update all import paths.

---

### Step 8: Update runtime-config.ts

**Major changes:**

- Remove `variables` from cache (use ConfigValues for non-secrets)
- Only load secrets
- Remove `getVariable()`, `getSystemParam()`, `getVariableKeys()` functions
- Keep `getSecret()`, `getSecretKeys()` functions

```typescript
// Cache structure change
interface RuntimeConfigCache {
  // REMOVE: variables: Map<string, Map<string, string>>
  secrets: Map<string, Map<string, string>>
  metadata: { ... }
}

// REMOVE these functions:
export function getVariable(...) { ... }
export function getSystemParam(...) { ... }
export function getVariableKeys(...) { ... }
export function getConfigValue(...) { ... }
export function getConfigValueSync(...) { ... }

// KEEP these functions:
export function getSecret(...) { ... }
export function getSecretKeys(...) { ... }
export function loadRuntimeConfig(...) { ... }
export function isConfigLoaded() { ... }
export function clearConfigCache() { ... }
```

---

### Step 9: Update runtime/types.ts

```typescript
// BEFORE
export interface RuntimeConfigCache {
  variables: Map<string, Map<string, string>>
  secrets: Map<string, Map<string, string>>
  metadata: RuntimeConfigMetadata
}

// AFTER
export interface RuntimeConfigCache {
  secrets: Map<string, Map<string, string>>
  metadata: RuntimeConfigMetadata
}
```

---

### Step 10: Update payload.config.ts

```typescript
// BEFORE
import { ConfigEntries } from './server/payload/collections/ConfigEntries'
collections: [ConfigEntries, ...]

// AFTER
import { ConfigSecrets } from './server/payload/collections/ConfigSecrets'
collections: [ConfigSecrets, ...]
```

---

### Step 11: Update Tests

**File:** `tests/int/config-manager.int.test.ts`

- Rename test suite from "ConfigEntries" to "ConfigSecrets"
- Remove all Variable/SystemParam test cases
- Keep Secret encryption tests
- Update collection slug references from `config_entries` to `config_secrets`
- Remove `kind` field from test data

---

### Step 12: Update payload-types.ts

Run:

```bash
pnpm generate:types
```

This will regenerate types with:

- `ConfigSecret` instead of `ConfigEntry`
- No `kind` field in the type
- Updated collection slug

---

## Migration Notes

### Database Migration

Existing data in `config_entries`:

1. **Variables** should have been migrated to ConfigValues already
2. **Secrets** remain but collection slug changes

Options:

- A) Drop and recreate (clean slate)
- B) MongoDB migration script to rename collection

### Breaking Changes

- `getVariable()` removed - use ConfigValues instead
- `getSystemParam()` removed - use ConfigValues instead
- `ConfigKind` enum removed
- Collection slug changes: `config_entries` → `config_secrets`

---

## File Summary

### Files to Create

- `src/server/payload/collections/ConfigSecrets.ts` (rename from ConfigEntries.ts)

### Files to Delete

- `src/server/payload/collections/ConfigEntries.ts` (renamed)
- `src/server/payload/hooks/configEntries/` (renamed to configSecrets/)

### Files to Modify

1. `src/infra/config/config-constants.ts` - Remove ConfigKind
2. `src/server/payload/hooks/configSecrets/beforeChange-hook.ts` - Always encrypt
3. `src/server/payload/hooks/configSecrets/afterRead-hook.ts` - Always hide
4. `src/server/payload/hooks/configSecrets/afterChange-hook.ts` - Remove kind
5. `src/server/payload/collections/ConfigAuditLogs.ts` - Remove kind field
6. `src/infra/config/runtime/runtime-config.ts` - Secrets only
7. `src/infra/config/runtime/types.ts` - Update cache type
8. `src/payload.config.ts` - Update import
9. `tests/int/config-manager.int.test.ts` - Update tests

---

## Execution Order

1. ✅ Update `config-constants.ts` (remove ConfigKind)
2. ✅ Rename hook directory
3. ✅ Update hooks (beforeChange, afterRead, afterChange)
4. ✅ Rename/update collection file
5. ✅ Update ConfigAuditLogs collection
6. ✅ Update payload.config.ts
7. ✅ Update runtime-config.ts and types.ts
8. ✅ Run `pnpm generate:types`
9. ✅ Update tests
10. ✅ Run `pnpm typecheck && pnpm lint && pnpm test:int`
