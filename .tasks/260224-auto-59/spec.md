# Spec: 260224-auto-59

## Overview

The exercise collection's hooks (`generateSlug` and `validateSlugUniqueness`) currently bypass transaction safety by falling back to a standalone Payload instance (`getPayloadInstance()`) when executing database queries. This breaks atomic transactions, as the standalone instance operates outside the context of the active request transaction. The fix is to strictly use the provided `req.payload` from the hook arguments and completely remove the standalone instance workaround.

## Requirements

### FR-001: Remove Standalone Payload Fallback

**Priority**: MUST
**Description**: Delete the `getPayloadInstance()` helper function entirely from `src/server/payload/collections/Exercises/hooks.ts`. This fallback is an anti-pattern in Payload CMS 3.x, as `req.payload` is guaranteed to be available during hook execution and creating a new instance breaks transaction boundaries.

### FR-002: Use `req.payload` Unconditionally

**Priority**: MUST
**Description**: Update the `generateSlug` and `validateSlugUniqueness` field hooks to use `req.payload` directly (instead of the `req?.payload ?? await getPayloadInstance()` logic).

### FR-003: Maintain Transaction Safety in Queries

**Priority**: MUST
**Description**: Verify that both hooks (`generateSlug` and `validateSlugUniqueness`) pass the `req` object to `req.payload.find()` calls. This already exists in the current code (lines 51 and 95) and ensures queries run within the active transaction context.

### NFR-001: Remove Anti-Pattern Fallback Tests

**Priority**: MUST
**Description**: Update `tests/unit/collections/exercises-hooks.test.ts` to remove any tests that explicitly test the `getPayloadInstance` fallback behavior (e.g., tests asserting the fallback when `req` or `req.payload` is undefined). Since the fallback is being removed and is considered an anti-pattern, these tests are no longer valid.

### NFR-002: Update Test Setup for req.payload

**Priority**: MUST
**Description**: Update the default `createHookArgs` helper function in the test file to provide a mock `req` object with `payload.find` pre-configured. This ensures all existing tests continue to work after removing the fallback. The mock should use the same configuration as the current `mockPayloadInstance.find` setup. Without this change, tests that don't explicitly provide `req` in their test arguments will fail when trying to access `req.payload`.

## Acceptance Criteria

- [ ] `getPayloadInstance()` function is deleted from `src/server/payload/collections/Exercises/hooks.ts`.
- [ ] `generateSlug` uses `req.payload` unconditionally (no fallback logic).
- [ ] `validateSlugUniqueness` uses `req.payload` unconditionally.
- [ ] Both hooks pass the `req` object to `req.payload.find()` (already implemented in current code).
- [ ] Tests asserting `getPayloadInstance` fallback behavior are removed from `tests/unit/collections/exercises-hooks.test.ts`.
- [ ] The default `createHookArgs` helper is updated to provide mock `req.payload.find` so all tests pass without the fallback.
- [ ] All remaining unit tests in `tests/unit/collections/exercises-hooks.test.ts` pass successfully.

## Guardrails

- Do not modify other collections or hooks outside of `Exercises`.
- Ensure `req` is correctly typed (via `FieldHook` type) so TypeScript errors do not occur. You may use non-null assertions (`req.payload!`) if required by strict TypeScript configurations, since Payload guarantees its presence at runtime.
- Maintain existing slug generation and validation logic (e.g. retries, string formatting, uniqueness checks); only the payload initialization and transaction scoping should change.

## Out of Scope

- Refactoring the slug logic itself (e.g., changing how the slug is formatted or the limit of 100 attempts).
- Modifying or fixing transaction safety in files other than `src/server/payload/collections/Exercises/hooks.ts`.