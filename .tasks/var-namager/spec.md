

# Task: Global Config Key/Value (Variables plaintext, Secrets encrypted)

## Goal

Implement a minimal admin-managed configuration store in Payload with a single global key/value table, where `value` is encrypted **only** for `kind=secret`, with audit logging and automated tests.

## Non-Goals

* No scope / scopeRef
* No resolution engine / precedence
* No client exposure of values
* No “view secret after save” UX

## Data Model

### Collection: `ConfigEntries`

Fields:

* `key` (string, required, unique, immutable, `snake_case`)
* `kind` (enum, required): `variable | secret`
* `value` (string, required)

  * If `kind=variable`: stored as plaintext
  * If `kind=secret`: stored encrypted at rest
* `enabled` (boolean, default=true)

Admin UI:

* List view columns: `key`, `kind`, `enabled`, `updatedAt` (no value column)
* Edit view:

  * `value` editable for both
  * For `kind=secret`: “write-only” behavior (after save, do not show decrypted value; field displays empty/placeholder and requires re-entry to rotate)

### Collection: `ConfigAuditLog` (append-only)

Fields:

* `key` (string, required)
* `kind` (enum, required): `variable | secret`
* `action` (enum): `created | updated | enabled | disabled`
* `actor` (relationship to Users, required)
* timestamp
* `reason` (string, optional)

Audit rules:

* For `kind=secret`: **never** store plaintext in audit (no before/after plaintext)
* For `kind=variable`: you may store before/after as plaintext **or** keep audit metadata-only (pick one; simplest is metadata-only for both)

## Encryption

* Env var: `CONFIG_MASTER_KEY` (required in runtime)
* Encrypt on create/update when `kind=secret`
* Decrypt utility exists for server-side usage only (never in Admin UI responses, never to client)

## Guardrails

* Enforce `snake_case` for `key`
* Optional (recommended): if `kind=variable`, block secret-like keys (`secret|token|apikey|api_key|password|private`) כדי למנוע “סיקרטים במסווה”.

## Tests

### Integration tests (Payload)

* Unique key enforced
* `key` immutability: update attempt fails
* enabled toggle works

### Encryption tests (Secrets)

* Saving secret stores encrypted value (DB value != plaintext)
* decrypt(encrypt(x)) == x
* decrypt fails with wrong master key
* Admin read/list does not leak decrypted secret

### Variable behavior tests

* `kind=variable` stores plaintext exactly as entered
* Variable updates do not run encryption

### Audit tests

* Create/update/enable/disable create `ConfigAuditLog` entries with actor/action
* Secret audit contains no plaintext secret value

## Acceptance Criteria

* Admin can CRUD entries
* Variables are stored plaintext
* Secrets are stored encrypted and never revealed in Admin UI after save
* Audit log is written for all mutations without leaking secrets
* Tests pass in CI

---
