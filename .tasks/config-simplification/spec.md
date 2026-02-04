# Task: Configuration Simplification (Config Values + Secrets Only)

## 1. Scope

```yaml
Feature: Configuration management simplification
Type: refactor
Impact: medium
```

**Goal**: Separate non-secret configuration values (bulk editable, domain-based) from secrets (always encrypted, sensitive only) to reduce operational friction and improve clarity.

---

## 2. Behaviors to Cover

### Stage 1: Config Values Collection (Non-Secret)

| ID | Behavior | Category |
|----|----------|----------|
| CV-1 | Should create configValues collection with domain-based JSON storage | Happy |
| CV-2 | Should enforce closed domain enum (chat, pdf_conversion, global) | Validation |
| CV-3 | Should store configuration as JSON object per domain | Happy |
| CV-4 | Should allow partial configuration (sparse JSON) | Edge |
| CV-5 | Should retrieve configuration by domain key | Happy |
| CV-6 | Should scope config values by tenant (tenant + domain = unique) | Happy |
| CV-7 | Should allow bulk editing of config values via Admin UI | Happy |
| CV-8 | Should reject secrets in config values (detect secret-like patterns) | Security |
| CV-9 | Should gracefully handle missing domain config at runtime | Failure |

### Stage 2: Config Secrets Collection (Secrets Only)

| ID | Behavior | Category |
|----|----------|----------|
| CS-1 | Should rename config_entries to config_secrets | Migration |
| CS-2 | Should remove `kind` field (all entries are secrets) | Refactor |
| CS-3 | Should always encrypt all stored values | Security |
| CS-4 | Should maintain write-only UX (never show decrypted) | Security |
| CS-5 | Should maintain audit logging for secret mutations | Security |
| CS-6 | Should update runtime loader to use new collection | Refactor |
| CS-7 | Should migrate existing secrets from config_entries | Migration |

### Cross-Cutting

| ID | Behavior | Category |
|----|----------|----------|
| CC-1 | Should maintain tenant isolation for both collections | Security |
| CC-2 | Should not break runtime behavior during migration | Regression |
| CC-3 | Should provide clear error messages for misconfiguration | Failure |

---

## 3. Expected Outcomes

### Config Values (Stage 1)

| Behavior | Observable Outcome |
|----------|-------------------|
| CV-1 | `config_values` collection exists with slug, admin group, access control |
| CV-2 | Create/update rejects domains not in enum; returns validation error |
| CV-3 | `config` field stores JSON object; retrievable via `index.search()` |
| CV-4 | Missing keys in JSON return undefined; partial config allowed |
| CV-5 | `getConfigDomain('chat')` returns domain config object |
| CV-6 | Unique constraint on (tenant, domain); duplicate returns 400 |
| CV-7 | Admin UI shows JSON editor for config field |
| CV-8 | Warning logged if JSON contains secret-like keys; optional hard block |
| CV-9 | Missing domain returns empty object `{}`; no runtime exception |

### Config Secrets (Stage 2)

| Behavior | Observable Outcome |
|----------|-------------------|
| CS-1 | Collection slug changes from `config_entries` to `config_secrets` |
| CS-2 | No `kind` field in schema; all hooks/code updated |
| CS-3 | All values encrypted with AES-256-GCM before storage |
| CS-4 | Admin UI shows empty/masked value after save |
| CS-5 | `config_audit_logs` tracks mutations with action type |
| CS-6 | `getSecret(key)` works with new collection; no API changes |
| CS-7 | Existing secrets preserved; variables migrated to config_values |

### Cross-Cutting

| Behavior | Observable Outcome |
|----------|-------------------|
| CC-1 | Each tenant has isolated config_values and config_secrets |
| CC-2 | All existing functionality works during/after migration |
| CC-3 | Invalid config returns structured error with guidance |

---

## 4. Out of Scope

- **Strong typing/schemas per config key** (deferred to future iteration)
- **Versioning, rollback, approvals** (not in this phase)
- **Advanced permissions/governance** (admin-only sufficient)
- **Environment management redesign** (keep tenant-scoped model)
- **Performance optimization** (current caching sufficient)
- **E2E tests** (integration tests only)
- **Admin UI customization** (use default Payload admin)
- **Config precedence rules** (environment → config_values → defaults)
- **Runtime cache invalidation** (manual reload sufficient)

---

## 5. Test Boundaries

```yaml
Test level: integration
Mocking: none (real Payload + MongoDB)
External services: none
Database: real (test MongoDB via Docker)
```

### Test Categories

| Category | Test Type | Location |
|----------|-----------|----------|
| ConfigValues CRUD | Integration | `tests/int/config-values.int.spec.ts` |
| ConfigValues validation | Integration | `tests/int/config-values.int.spec.ts` |
| ConfigSecrets CRUD | Integration | `tests/int/config-secrets.int.spec.ts` |
| Runtime loader | Integration | `tests/int/runtime-config.int.spec.ts` |
| Migration | Integration | `tests/int/config-migration.int.spec.ts` |

---

## 6. Stop Conditions

✓ All 19 behaviors have passing tests
✓ `pnpm test:int` passes for config-related tests
✓ `pnpm typecheck && pnpm lint && pnpm build` pass
✓ Migration script runs without data loss
✓ Runtime config loader works with both collections
✓ No regressions in existing config usage
✓ Admin UI functional for both collections

---

## 7. Deliverables

```yaml
Tests:
  - tests/int/config-values.int.spec.ts (~9 tests)
  - tests/int/config-secrets.int.spec.ts (~7 tests)
  - tests/int/runtime-config.int.spec.ts (~3 tests)
CI: required (test:int in CI)
Docs: Update CLAUDE.md config section
i18n: n/a (admin-only)
Migrations:
  - Migration script for config_entries → config_secrets
  - Migration script for variables → config_values
Types: yes (pnpm generate:types after collection changes)
```

---

## 8. Risk & Rollback

```yaml
Breaking: Config loading may fail if migration incomplete
Blast radius: module (config system only, admin-only access)
Rollback:
  - Revert collection changes
  - Restore config_entries backup
  - Re-run reverse migration script
Data safety: medium (backup config_entries before migration)
```

### Mitigation Strategies

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Backup config_entries before running |
| Runtime failures | Maintain backward compat getters during transition |
| Missing config | Graceful fallback to empty objects/defaults |
| Encryption key issues | Same CONFIG_MASTER_KEY used throughout |

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Config precedence | env vars → runtime config → hardcoded defaults |
| Runtime caching | Keep existing cache; manual reload via `reloadRuntimeConfig()` |
| Migration sequencing | Stage 1 (configValues) → Stage 2 (configSecrets) |
| Admin/API exposure | Admin-only access for both collections |
| Domain enum extensibility | Closed enum; add new domains via code change |
