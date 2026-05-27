# Task 2115 — Fix CI failure: field-level afterRead hooks returning empty strings

## Root Cause

The field-level `afterRead` hooks in `computeListDisplayFields-hook.ts` were typed as `CollectionAfterReadHook` and destructured `doc` from their argument. However, Payload CMS field hooks receive `FieldHookArgs` (not `CollectionAfterReadHook`), which does NOT have a `doc` property — it has `siblingData` (the parent document) and `value` (the field's current value).

Because `doc` was destructured from `FieldHookArgs` where it doesn't exist, `doc` was `undefined` at runtime. The null guard `if (!doc) return ''` then returned empty strings for all computed fields, causing all 10 tests to fail with `expected '' to be 'Active'`, etc.

The `as any` cast on the hooks in `Coupons.ts` suppressed the TypeScript error but did not fix the runtime behavior.

## Fix

1. Changed the import from `CollectionAfterReadHook` to `FieldHookArgs`
2. Changed each hook to destructure `siblingData` instead of `doc`
3. Passed `siblingData` to the compute functions as the document source
4. Removed the now-unnecessary `as any` casts from `Coupons.ts`

This matches the pattern used by other field-level `afterRead` hooks in the codebase (e.g., `configSecrets/afterRead-hook.ts`).
