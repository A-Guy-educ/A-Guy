# Plan: 260224-auto-59 — Fix Transaction Safety in Exercises Hooks

## Summary

Remove the `getPayloadInstance()` anti-pattern fallback from the Exercises hooks file. Both `generateSlug` and `validateSlugUniqueness` currently fall back to a standalone Payload instance when `req.payload` is missing, which breaks transaction boundaries. Since Payload 3.x guarantees `req.payload` during hook execution, the fallback is unnecessary and harmful. The fix is to delete the helper, use `req.payload` unconditionally, and update tests accordingly.

## Assumptions

- `req.payload` is always available during Payload 3.x field hook execution (documented Payload guarantee).
- No other files import or depend on `getPayloadInstance()` from the hooks file.
- The `formatSlug` helper and slug logic itself are correct and out of scope.

---

### Step 1: Remove `getPayloadInstance` and Use `req.payload` Unconditionally

**Root Cause**: Lines 7-11 define `getPayloadInstance()`, and lines 31 and 80 use `req?.payload ?? (await getPayloadInstance())`. This fallback creates a new Payload instance outside the request transaction, breaking atomicity. (FR-001, FR-002, FR-003)

**Files to Touch**:
- `src/server/payload/collections/Exercises/hooks.ts` (MODIFIED — lines 7-11 DELETE, line 31 MODIFY, line 80 MODIFY)

**Changes**:
1. **Delete lines 7-11**: Remove the entire `getPayloadInstance` async function.
2. **Modify line 31**: Change `const payload = req?.payload ?? (await getPayloadInstance())` → `const payload = req.payload` (use direct access; Payload guarantees `req` and `req.payload` exist in hooks).
3. **Modify line 80**: Same change — `const payload = req?.payload ?? (await getPayloadInstance())` → `const payload = req.payload`.
4. **Remove the `payload` and `@payload-config` dynamic imports** (lines 8-10) since they are only used by the deleted function.
5. **Keep `req` being passed to `payload.find()`** on lines 51 and 95 (already correct — no change needed).

**Reproduction Test** (verifies the bug exists before fix):
- Test location: `tests/unit/collections/exercises-hooks.test.ts`
- Test: "should NOT call getPayload when req.payload is available" — call `generateSlug` with a valid `req.payload.find` mock, then assert `mockGetPayload` was NOT called. Currently this test would expose that `getPayloadInstance` is importable and usable.
- The existing test at line 265-298 ("fallback to getPayloadInstance") currently PASSES — after the fix, those tests should be REMOVED because the fallback no longer exists.

**Verification**:
- `pnpm tsc --noEmit` passes (no type errors).
- The `getPayloadInstance` function is no longer exported or present.
- `req.payload` is used directly in both hooks.

**Acceptance Criteria**:
- [ ] `getPayloadInstance()` function deleted from hooks.ts (FR-001)
- [ ] `generateSlug` uses `req.payload` directly, no fallback (FR-002)
- [ ] `validateSlugUniqueness` uses `req.payload` directly, no fallback (FR-002)
- [ ] Both hooks still pass `req` to `payload.find()` calls (FR-003)
- [ ] No dynamic imports of `payload` or `@payload-config` remain in the file

---

### Step 2: Update Tests — Remove Fallback Tests and Fix `createHookArgs` Default

**Root Cause**: The test file has (1) tests for the now-removed `getPayloadInstance` fallback (lines 264-299), and (2) the `createHookArgs` helper defaults `req` to `undefined` (line 49 and line 338). After removing the fallback, any test that doesn't explicitly provide `req` will crash with "Cannot read properties of undefined (reading 'payload')". (NFR-001, NFR-002)

**Files to Touch**:
- `tests/unit/collections/exercises-hooks.test.ts` (MODIFIED — multiple sections)

**Changes**:

#### 2a. Update both `createHookArgs` helpers to provide a default mock `req.payload`

In the `generateSlug` describe block (line 43-58), change:
```typescript
req: undefined as any,
```
to:
```typescript
req: { payload: { find: mockFind } } as any,
```

In the `validateSlugUniqueness` describe block (line 330-345), apply the same change:
```typescript
req: undefined as any,
```
to:
```typescript
req: { payload: { find: mockFind } } as any,
```

This ensures all tests that don't explicitly override `req` will use the shared `mockFind` mock (which is already configured in `beforeEach` to return `{ docs: [] }`).

#### 2b. Delete the "fallback to getPayloadInstance" describe block

Remove lines 264-299 entirely (the `describe('fallback to getPayloadInstance (FR-003 guardrail)')` block containing 2 tests):
- `'uses getPayloadInstance when req is undefined'`
- `'uses getPayloadInstance when req.payload is undefined'`

These tests validated the anti-pattern we are removing.

#### 2c. Remove or update the `payload` and `@payload-config` mocks

Lines 10-20 mock `payload` and `@payload-config` modules purely for the `getPayloadInstance` fallback. After removing the fallback, these mocks are no longer needed by the production code. However, **keep them in place** to avoid import errors — the hooks file previously imported these dynamically, but after Step 1 removes those imports, the mocks become inert but harmless. If the build agent prefers, they can be removed, but it's safer to keep them to avoid module resolution issues in the test environment.

Alternatively, if removing the mocks: delete lines 10-20 (`const mockGetPayload`, `vi.mock('payload', ...)`, `vi.mock('@payload-config', ...)`), and remove `mockGetPayload.mockResolvedValue(mockPayloadInstance)` from both `beforeEach` blocks (lines 39 and 326).

**Recommended approach**: Remove the mocks entirely since the production code no longer dynamically imports `payload` or `@payload-config`. This is cleaner. Also remove `mockGetPayload` references from `beforeEach` blocks.

#### 2d. Add a new test verifying `req.payload` is used directly

Add this test to the existing "transaction safety" describe block:

```typescript
it('does not import a standalone payload instance', async () => {
  const localMockFind = vi.fn().mockResolvedValue({ docs: [] })
  const mockReq = { payload: { find: localMockFind } }

  await generateSlug(
    createHookArgs({
      siblingData: { title: 'Test Exercise', lesson: 'lesson-1' },
      req: mockReq as any,
    }),
  )

  // Should use req.payload.find exclusively
  expect(localMockFind).toHaveBeenCalledTimes(1)
})
```

**Tests that FAIL before fix, PASS after**:
1. Any test calling `generateSlug` or `validateSlugUniqueness` without providing `req` would crash after Step 1 (since the fallback is removed). The updated `createHookArgs` default (Step 2a) makes them pass again.
2. The new test "does not import a standalone payload instance" validates the anti-pattern is gone.

**Tests that PASS before fix, are REMOVED after**:
1. `'uses getPayloadInstance when req is undefined'` — removed (NFR-001)
2. `'uses getPayloadInstance when req.payload is undefined'` — removed (NFR-001)

**Verification**:
- Run `pnpm vitest run tests/unit/collections/exercises-hooks.test.ts` — all tests pass.
- No test references `getPayloadInstance` or `mockGetPayload`.

**Acceptance Criteria**:
- [ ] `createHookArgs` in both describe blocks defaults `req` to `{ payload: { find: mockFind } }` (NFR-002)
- [ ] "fallback to getPayloadInstance" describe block (2 tests) is deleted (NFR-001)
- [ ] All remaining tests pass (`pnpm vitest run tests/unit/collections/exercises-hooks.test.ts`)
- [ ] No references to `getPayloadInstance` remain in the test file

---

## Execution Order

1. **Step 1** first — modify the production code (hooks.ts).
2. **Step 2** second — update the tests to match the new code.
3. Run full verification: `pnpm tsc --noEmit && pnpm vitest run tests/unit/collections/exercises-hooks.test.ts`

## Files Changed Summary

| File | Action | Lines Affected |
|------|--------|---------------|
| `src/server/payload/collections/Exercises/hooks.ts` | MODIFIED | Delete lines 7-11; modify lines 31, 80 |
| `tests/unit/collections/exercises-hooks.test.ts` | MODIFIED | Update lines 49, 338 (createHookArgs default req); delete lines 264-299 (fallback tests); optionally remove lines 10-20 and beforeEach mock setup lines |

## Quality Gates

- [ ] `pnpm tsc --noEmit` — zero type errors
- [ ] `pnpm vitest run tests/unit/collections/exercises-hooks.test.ts` — all tests pass
- [ ] `pnpm lint` — no lint errors
- [ ] No references to `getPayloadInstance` in `hooks.ts` or test file
