# Fix #2012 (follow-up to #2011): Guard null-check type mismatch

## Root Cause

Two bugs caused 3 tests to fail:

1. **Guard used strict equality (`=== null`)** — the tenant isolation guards in `route.ts` checked `userTenantId === null`. But `optionalTenantField` (used on Users) doesn't auto-populate and can leave the `tenant` field as `undefined` (not stored at all in MongoDB). `extractTenantId(undefined)` returns `null` (via falsy check), but `undefined === null` is `false`, so the guard could miss the null-tenant case.

2. **Test created user with `tenant` omitted** — the new tests created a user without explicitly setting `tenant: null`. When `optionalTenantField` is used and the field is omitted, Payload may return `tenant: undefined` (not `null`) when the document is fetched. The test assertion `expect(tenant).toBeNull()` failed because the value was `undefined`.

## Fix

**route.ts** (lines 119, 270): Changed `userTenantId === null` to `userTenantId == null` (loose equality catches both `null` AND `undefined`).

**checkout-tenant-isolation.int.spec.ts** (line 165): Changed user creation from omitting `tenant` to explicitly setting `tenant: null`.

## Why This Works

`== null` (loose equality) is `true` for both `null` AND `undefined`. This makes the guard resilient to:
- `tenant: null` (explicitly set)
- `tenant: undefined` (field absent from document)

Both now trigger the fail-closed guard correctly.
