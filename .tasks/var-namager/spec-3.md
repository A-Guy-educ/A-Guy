תשובה

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

תן לסוכן את זה כמו שהוא.
עכשיו תחליט דבר אחד כדי שלא נתקע באמצע: אתה רוצה **לאסור env override** בטננטים (פשוט), או להוסיף naming convention ל־env override (מסובך אבל חזק)?
