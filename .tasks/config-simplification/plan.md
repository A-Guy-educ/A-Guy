# Plan: Configuration Simplification (Config Values + Secrets Only)

## 1. Overview

**Objective**: Simplify configuration management by separating non-secret config values (domain-based JSON) from secrets (always encrypted), improving clarity and operational efficiency.

**Impact**: `medium` — touches config system internals, admin UI, runtime loader; no user-facing changes

**Rollout**: `safe default` — backward-compatible getters maintained; migration can be paused/reverted

---

## 2. Requirements → Plan Map

| Requirement                  | Stage    | Files                                | Tests                        |
| ---------------------------- | -------- | ------------------------------------ | ---------------------------- |
| CV-1 Collection creation     | 1.1      | ConfigValues.ts                      | config-values.int.spec.ts    |
| CV-2 Domain enum             | 1.1      | config-constants.ts, ConfigValues.ts | config-values.int.spec.ts    |
| CV-3 JSON storage            | 1.1      | ConfigValues.ts                      | config-values.int.spec.ts    |
| CV-4 Partial config          | 1.2      | runtime-config.ts                    | config-values.int.spec.ts    |
| CV-5 Domain retrieval        | 1.2      | runtime-config.ts                    | config-values.int.spec.ts    |
| CV-6 Tenant scoping          | 1.1      | ConfigValues.ts, beforeChange-hook   | config-values.int.spec.ts    |
| CV-7 Admin UI editing        | 1.1      | ConfigValues.ts admin config         | Manual verification          |
| CV-8 Secret detection        | 1.3      | beforeChange-hook.ts                 | config-values.int.spec.ts    |
| CV-9 Missing domain fallback | 1.2      | runtime-config.ts                    | config-values.int.spec.ts    |
| CS-1 Rename collection       | 2.1      | ConfigSecrets.ts                     | config-secrets.int.spec.ts   |
| CS-2 Remove kind field       | 2.1      | ConfigSecrets.ts, hooks              | config-secrets.int.spec.ts   |
| CS-3 Always encrypt          | 2.1      | beforeChange-hook.ts                 | config-secrets.int.spec.ts   |
| CS-4 Write-only UX           | 2.1      | afterRead-hook.ts                    | config-secrets.int.spec.ts   |
| CS-5 Audit logging           | 2.1      | afterChange-hook.ts                  | config-secrets.int.spec.ts   |
| CS-6 Update loader           | 2.2      | runtime-config.ts                    | runtime-config.int.spec.ts   |
| CS-7 Migration               | 2.3      | migrate-config.ts                    | config-migration.int.spec.ts |
| CC-1 Tenant isolation        | 1.1, 2.1 | Both collections                     | Both test files              |
| CC-2 No runtime breaks       | 2.2      | runtime-config.ts                    | runtime-config.int.spec.ts   |
| CC-3 Error messages          | 1.2, 2.2 | errors.ts                            | Both test files              |

---

## 3. Stages

### Stage 1: Config Values Collection

**Risk Level**: Low — new collection, no existing data affected

---

#### Stage 1.1: Collection Definition

**Scope**: Create ConfigValues collection with domain-based JSON storage

**Deliverables**:

- `src/server/payload/collections/ConfigValues.ts`
- `src/infra/config/config-constants.ts` (add ConfigDomain enum)
- `src/server/payload/hooks/configValues/beforeChange-hook.ts`
- Register collection in `payload.config.ts`
- `pnpm generate:types`

**Implementation Details**:

```typescript
// config-constants.ts additions
export const ConfigDomain = {
  Chat: 'chat',
  PdfConversion: 'pdf_conversion',
  Global: 'global',
} as const

export type ConfigDomain = (typeof ConfigDomain)[keyof typeof ConfigDomain]

export const CONFIG_DOMAINS = Object.values(ConfigDomain)
```

```typescript
// ConfigValues.ts schema
{
  slug: 'config_values',
  admin: {
    useAsTitle: 'domain',
    defaultColumns: ['domain', 'tenant', 'updatedAt'],
    group: 'System',
  },
  access: {
    create: configAdminOnly,
    read: configAdminOnly,
    update: configAdminOnly,
    delete: configAdminOnly,
  },
  fields: [
    {
      name: 'domain',
      type: 'select',
      required: true,
      options: CONFIG_DOMAINS.map(d => ({ label: d, value: d })),
      index: true,
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
    },
    {
      name: 'config',
      type: 'json',
      required: true,
      admin: {
        description: 'Configuration values as JSON object',
      },
    },
    {
      name: 'description',
      type: 'text',
      admin: {
        description: 'Optional description of this configuration',
      },
    },
  ],
  hooks: {
    beforeChange: [beforeChangeValidateConfigValues],
  },
  timestamps: true,
}
```

**Verification**:

- [ ] Collection appears in Admin UI under System group
- [ ] Domain select shows 3 options
- [ ] JSON editor works for config field
- [ ] Types generated successfully

**Exit Criteria**:

- `pnpm generate:types` succeeds
- `pnpm typecheck` passes
- Collection visible in Admin UI

**Constraints Check**: `compliant`

- Uses Payload collection pattern ✓
- No direct DB access ✓

**Risk Note**: Low — new collection, isolated from existing config

---

#### Stage 1.2: Runtime Loader for Config Values

**Scope**: Add functions to load and access domain-based config values

**Deliverables**:

- `src/infra/config/runtime/config-values.ts` (new)
- Update `src/infra/config/runtime/index.ts` exports
- Add `ConfigValueNotFoundError` to errors.ts

**Implementation Details**:

```typescript
// config-values.ts
interface ConfigValuesCache {
  values: Map<string, Map<ConfigDomain, Record<string, unknown>>>
  metadata: { loadedAt: Date; domainCount: number }
}

export async function loadConfigValues(
  payload: Payload,
  tenantId?: string,
): Promise<LoadConfigValuesResult>

export function getConfigDomain<T = Record<string, unknown>>(
  domain: ConfigDomain,
  options?: { tenantId?: string },
): T

export function getConfigValue<T>(
  domain: ConfigDomain,
  key: string,
  options?: { tenantId?: string; defaultValue?: T },
): T
```

**Test File**: `tests/int/config-values.int.spec.ts`

```typescript
describe('ConfigValues', () => {
  // CV-1: Collection creation
  it('should create config values entry for domain', async () => {})

  // CV-2: Domain enum validation
  it('should reject invalid domain', async () => {})

  // CV-3: JSON storage
  it('should store and retrieve JSON config', async () => {})

  // CV-4: Partial config
  it('should allow partial config with missing keys', async () => {})

  // CV-5: Domain retrieval
  it('should retrieve config by domain key', async () => {})

  // CV-6: Tenant scoping
  it('should enforce tenant + domain uniqueness', async () => {})

  // CV-9: Missing domain fallback
  it('should return empty object for missing domain', async () => {})
})
```

**Verification**:

- [ ] All 7 tests pass
- [ ] `getConfigDomain()` returns correct values
- [ ] Missing domains return `{}`

**Exit Criteria**:

- Tests green: 7/7
- `pnpm typecheck` passes

**Constraints Check**: `compliant`

**Risk Note**: Low — new code path, existing config unaffected

---

#### Stage 1.3: Secret Detection for Config Values

**Scope**: Warn/block if config values contain secret-like keys

**Deliverables**:

- Update `src/server/payload/hooks/configValues/beforeChange-hook.ts`

**Implementation Details**:

```typescript
// In beforeChange hook
function validateNoSecrets(config: Record<string, unknown>): void {
  const secretKeys = Object.keys(config).filter(looksLikeSecret)
  if (secretKeys.length > 0) {
    // Log warning (soft validation)
    payload.logger.warn({
      msg: 'Config values contain secret-like keys',
      keys: secretKeys,
    })
    // Optional: throw error for hard block
    // throw new Error(`Secret-like keys detected: ${secretKeys.join(', ')}`)
  }
}
```

**Test Addition**: `tests/int/config-values.int.spec.ts`

```typescript
// CV-8: Secret detection
it('should warn when config contains secret-like keys', async () => {})
```

**Verification**:

- [ ] Warning logged for secret-like keys
- [ ] Config still saves (soft validation)

**Exit Criteria**:

- Test passes
- Warning visible in logs

**Constraints Check**: `compliant`

**Risk Note**: Low — soft validation only

---

### Stage 2: Config Secrets Collection

**Risk Level**: Medium — modifies existing collection, requires migration

---

#### Stage 2.1: Collection Transformation

**Scope**: Transform config_entries → config_secrets (secrets only)

**Deliverables**:

- Rename `src/server/payload/collections/ConfigEntries.ts` → `ConfigSecrets.ts`
- Update slug from `config_entries` to `config_secrets`
- Remove `kind` field and related logic
- Update hooks to assume all entries are secrets
- Update `payload.config.ts` registration

**Implementation Details**:

```typescript
// ConfigSecrets.ts changes
export const ConfigSecrets: CollectionConfig = {
  slug: 'config_secrets', // Changed from config_entries
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'title', 'tenant', 'enabled', 'updatedAt'],
    group: 'System',
    description: 'Tenant-scoped encrypted secrets. All values are encrypted at rest.',
  },
  fields: [
    // key field - unchanged
    // tenant field - unchanged
    // title field - unchanged
    // value field - unchanged (always encrypted)
    // enabled field - unchanged
    // REMOVED: kind field
  ],
  // ... hooks updated
}
```

**Hook Changes**:

```typescript
// beforeChange-hook.ts
// Remove: kind immutability check
// Remove: kind-based encryption conditional
// Always encrypt value (no kind check)
data.value = encryptSecret(data.value)

// afterRead-hook.ts
// Remove: kind check for hiding value
// Always hide value (write-only for all)
return ''

// afterChange-hook.ts
// Remove: kind field from audit log
// Log action as 'secret' type always
```

**Test File**: `tests/int/config-secrets.int.spec.ts`

```typescript
describe('ConfigSecrets', () => {
  // CS-1: Collection rename
  it('should use config_secrets slug', async () => {})

  // CS-2: No kind field
  it('should not have kind field in schema', async () => {})

  // CS-3: Always encrypt
  it('should encrypt all values', async () => {})

  // CS-4: Write-only UX
  it('should return empty value in admin read', async () => {})

  // CS-5: Audit logging
  it('should create audit log on mutation', async () => {})

  // CC-1: Tenant isolation
  it('should enforce tenant + key uniqueness', async () => {})
})
```

**Verification**:

- [ ] All 6 tests pass
- [ ] No `kind` field in generated types
- [ ] All values encrypted in DB

**Exit Criteria**:

- Tests green: 6/6
- `pnpm generate:types` succeeds
- `pnpm typecheck` passes

**Constraints Check**: `compliant`

**Risk Note**: Medium — existing collection modified; migration required

---

#### Stage 2.2: Runtime Loader Update

**Scope**: Update runtime-config.ts to use config_secrets collection

**Deliverables**:

- Update `src/infra/config/runtime/runtime-config.ts`
- Remove variables/systemParams from secrets loader
- Integrate with config-values loader

**Implementation Details**:

```typescript
// runtime-config.ts changes

// Remove: variables cache (moved to config-values.ts)
// Keep: secrets cache only

export async function loadRuntimeConfig(
  payload: Payload,
  tenantId?: string,
): Promise<LoadConfigResult> {
  // Load secrets from config_secrets
  const secretResult = await payload.find({
    collection: 'config_secrets', // Changed from config_entries
    where: { enabled: { equals: true } },
    // ...
  })

  // Load config values (new)
  await loadConfigValues(payload, tenantId)

  // Process secrets only (no kind check)
  for (const doc of secretResult.docs) {
    secrets.get(tId)!.set(key, decryptSecret(value))
  }
}

// Update getVariable to use config values
export function getVariable(key: string, options?: GetConfigOptions): string {
  // Try config values first (by domain inference or explicit domain)
  // Fall back to legacy behavior during transition
}
```

**Test File**: `tests/int/runtime-config.int.spec.ts`

```typescript
describe('RuntimeConfig', () => {
  // CS-6: Updated loader
  it('should load secrets from config_secrets collection', async () => {})

  // CC-2: No runtime breaks
  it('should maintain getSecret() API compatibility', async () => {})

  // CC-3: Error messages
  it('should return clear error for missing secret', async () => {})
})
```

**Verification**:

- [ ] All 3 tests pass
- [ ] Existing `getSecret()` calls work
- [ ] Config values accessible via `getConfigDomain()`

**Exit Criteria**:

- Tests green: 3/3
- No runtime exceptions

**Constraints Check**: `compliant`

**Risk Note**: Medium — affects runtime config loading

---

#### Stage 2.3: Migration Script

**Scope**: Migrate existing config_entries data to new structure

**Deliverables**:

- `src/scripts/migrate-config.ts`
- Migration test

**Implementation Details**:

```typescript
// migrate-config.ts
export async function migrateConfig(payload: Payload): Promise<MigrationResult> {
  const result = { secretsMigrated: 0, valuesMigrated: 0, errors: [] }

  // Step 1: Backup (log existing state)
  const existing = await payload.find({
    collection: 'config_entries',
    limit: 1000,
    overrideAccess: true,
  })

  // Step 2: Migrate secrets (kind='secret')
  for (const entry of existing.docs.filter((e) => e.kind === 'secret')) {
    await payload.create({
      collection: 'config_secrets',
      data: {
        key: entry.key,
        tenant: entry.tenant,
        title: entry.title,
        value: entry.value, // Already encrypted
        enabled: entry.enabled,
      },
      overrideAccess: true,
    })
    result.secretsMigrated++
  }

  // Step 3: Migrate variables to config_values
  // Group by inferred domain
  const variablesByDomain = groupByDomain(
    existing.docs.filter((e) => e.kind === 'variable' || e.kind === 'system_param'),
  )

  for (const [domain, entries] of variablesByDomain) {
    const config = entries.reduce((acc, e) => {
      acc[e.key] = e.value
      return acc
    }, {})

    await payload.create({
      collection: 'config_values',
      data: {
        domain,
        tenant: entries[0].tenant,
        config,
      },
      overrideAccess: true,
    })
    result.valuesMigrated += entries.length
  }

  return result
}

function groupByDomain(entries): Map<ConfigDomain, ConfigEntry[]> {
  // Infer domain from key prefix or explicit mapping
  // pdf_conversion_* → pdf_conversion
  // chat_* → chat
  // Others → global
}
```

**Test File**: `tests/int/config-migration.int.spec.ts`

```typescript
describe('ConfigMigration', () => {
  // CS-7: Migration
  it('should migrate secrets to config_secrets', async () => {})
  it('should migrate variables to config_values by domain', async () => {})
  it('should preserve encrypted values during migration', async () => {})
  it('should handle empty config_entries gracefully', async () => {})
})
```

**Verification**:

- [ ] All 4 tests pass
- [ ] Secrets preserved with encryption
- [ ] Variables grouped by domain correctly

**Exit Criteria**:

- Tests green: 4/4
- Migration script runs idempotently

**Constraints Check**: `compliant`

**Risk Note**: High — data migration; requires backup

---

### Stage 3: Cleanup and Documentation

**Risk Level**: Low — housekeeping

---

#### Stage 3.1: Remove Deprecated Code

**Scope**: Remove old config_entries references and deprecated getters

**Deliverables**:

- Remove `getVariableLegacy`, `getSecretLegacy`
- Update all imports to use new collection names
- Remove `ConfigKind.Variable`, `ConfigKind.SystemParam` (keep `ConfigKind.Secret` or remove entirely)
- Update `config-constants.ts`

**Exit Criteria**:

- `pnpm typecheck` passes
- No references to old patterns

---

#### Stage 3.2: Documentation Update

**Scope**: Update CLAUDE.md and inline docs

**Deliverables**:

- Update `CLAUDE.md` config section
- Update JSDoc in runtime-config.ts
- Add migration notes to spec.md

**Exit Criteria**:

- Docs accurate
- Examples work

---

## 4. Test Plan (Staged)

| Stage | Test File                    | Test Count | Red-First Focus                |
| ----- | ---------------------------- | ---------- | ------------------------------ |
| 1.1   | config-values.int.spec.ts    | 3          | CV-6 (tenant uniqueness)       |
| 1.2   | config-values.int.spec.ts    | 4          | CV-9 (missing domain fallback) |
| 1.3   | config-values.int.spec.ts    | 1          | CV-8 (secret detection)        |
| 2.1   | config-secrets.int.spec.ts   | 6          | CS-3 (always encrypt)          |
| 2.2   | runtime-config.int.spec.ts   | 3          | CC-2 (no runtime breaks)       |
| 2.3   | config-migration.int.spec.ts | 4          | CS-7 (migration correctness)   |

**Total**: 21 tests

**Critical Red-First Tests**:

1. `CS-3`: Always encrypt — ensures no plaintext leaks
2. `CC-2`: No runtime breaks — ensures backward compatibility
3. `CS-7`: Migration correctness — ensures no data loss

---

## 5. Data & Migration

```yaml
Changes: schema + data
Migration: forward-only (reversible via backup)
Backfill: migrate existing config_entries
Rollback: restore backup + revert collection changes
```

### Migration Sequence

1. **Backup**: Export config_entries to JSON
2. **Stage 1**: Create config_values collection (no data yet)
3. **Stage 2.1**: Create config_secrets collection schema
4. **Stage 2.3**: Run migration script
5. **Verify**: Check data integrity
6. **Cleanup**: Remove old config_entries collection (optional, can keep as backup)

### Domain Inference Rules

| Key Pattern                     | Inferred Domain                  |
| ------------------------------- | -------------------------------- |
| `pdf_conversion_*`              | `pdf_conversion`                 |
| `chat_*`                        | `chat`                           |
| `LLM_*`, `OPENAI_*`, `GEMINI_*` | `chat` (secrets stay as secrets) |
| Others                          | `global`                         |

---

## 6. Rollout & Monitoring

```yaml
Environments: dev → staging → prod
Feature flag: none (atomic deployment)
```

### Monitoring

| Signal                     | Metric                   | Alert Threshold |
| -------------------------- | ------------------------ | --------------- |
| Config load failures       | Error logs               | Any error       |
| Missing secrets at runtime | `ConfigKeyNotFoundError` | Any occurrence  |
| Encryption failures        | Error logs               | Any error       |

### Success Signals

- All existing config consumers work without changes
- Admin UI shows both collections
- Migration completes without errors

### Failure Signals

- `ConfigNotLoadedError` at runtime
- Decryption failures (wrong master key)
- Missing config values breaking features

---

## 7. Stop Conditions

**DONE** only if:

- [ ] All 21 tests pass
- [ ] All behaviors mapped and verified
- [ ] Migration script runs successfully
- [ ] `pnpm typecheck && pnpm lint && pnpm build` pass
- [ ] No runtime regressions
- [ ] Documentation updated
- [ ] Backup created before migration

---

## File Summary

### New Files

| Path                                                         | Purpose                             |
| ------------------------------------------------------------ | ----------------------------------- |
| `src/server/payload/collections/ConfigValues.ts`             | Config values collection            |
| `src/server/payload/collections/ConfigSecrets.ts`            | Config secrets collection (renamed) |
| `src/server/payload/hooks/configValues/beforeChange-hook.ts` | Validation hook                     |
| `src/infra/config/runtime/config-values.ts`                  | Config values loader                |
| `src/scripts/migrate-config.ts`                              | Migration script                    |
| `tests/int/config-values.int.spec.ts`                        | Config values tests                 |
| `tests/int/config-secrets.int.spec.ts`                       | Config secrets tests                |
| `tests/int/config-migration.int.spec.ts`                     | Migration tests                     |

### Modified Files

| Path                                              | Changes                             |
| ------------------------------------------------- | ----------------------------------- |
| `src/server/payload/collections/ConfigEntries.ts` | Rename → ConfigSecrets, remove kind |
| `src/infra/config/config-constants.ts`            | Add ConfigDomain enum               |
| `src/infra/config/runtime/runtime-config.ts`      | Use new collections                 |
| `src/infra/config/runtime/index.ts`               | Export new functions                |
| `src/payload.config.ts`                           | Register new collections            |
| `CLAUDE.md`                                       | Update config documentation         |

### Deleted Files

| Path                         | Reason                                       |
| ---------------------------- | -------------------------------------------- |
| (none until Stage 3 cleanup) | Migration preserves old collection initially |

---

## Execution Order

```
Stage 1.1 → Stage 1.2 → Stage 1.3 → Stage 2.1 → Stage 2.2 → Stage 2.3 → Stage 3.1 → Stage 3.2
   │           │           │           │           │           │           │           │
   └─ Types ───┴─ Tests ───┴─ Tests ───┴─ Types ───┴─ Tests ───┴─ Tests ───┴─ Cleanup ─┴─ Docs
```

**Parallelization**: Stages 1.x can be developed in parallel with test writing. Stage 2.x depends on Stage 1 completion.
