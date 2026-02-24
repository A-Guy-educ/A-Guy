# Plan: Fix Exercise Hooks Transaction Safety

**Task ID**: 260224-auto-38
**Task Type**: fix_bug
**Risk Level**: HIGH
**Issue**: #505

## Summary

The `generateSlug` and `validateSlugUniqueness` hooks in `src/server/payload/collections/Exercises/hooks.ts` contain a `getPayloadInstance()` helper that creates a standalone Payload instance via `getPayload({ config })`. This standalone instance operates outside the current request's database transaction, creating a race condition risk for slug uniqueness checks. The fix removes the standalone fallback and mandates use of `req.payload` which is always provided by Payload's hook system.

## Assumptions

1. Payload CMS **always** provides `req` with a valid `req.payload` in `FieldHook` callbacks. This is documented Payload behavior — hooks are never called without a request context.
2. There are no external callers of `generateSlug` or `validateSlugUniqueness` that pass `req: undefined`. These are only used as Payload field hooks.
3. The existing "fallback to getPayloadInstance" tests in the test file should be **replaced** with tests asserting that missing `req.payload` throws an error (fail-fast behavior).

---

### Step 1: Add Reproduction Tests & Update Existing Tests

**Root Cause**: `getPayloadInstance()` on lines 7-11 creates a standalone Payload instance that runs queries outside the request transaction. Lines 31 and 80 use this as a fallback via `req?.payload ?? (await getPayloadInstance())`.

**Files to Touch**:
- `tests/unit/collections/exercises-hooks.test.ts` (MODIFIED — replace fallback tests, add reproduction test)

**Reproduction Test** (MUST FAIL before fix):

1. **Test: `generateSlug should NOT call getPayload when req.payload is available`**
   - Location: `tests/unit/collections/exercises-hooks.test.ts`
   - What it tests: When `req.payload` is provided, `getPayload` (the module-level mock) must NOT be called at all
   - Why it currently fails: The current code calls `req?.payload ?? (await getPayloadInstance())` which correctly uses `req.payload` when available, so this test will actually PASS now. This is a regression guard.

2. **Test: `generateSlug should throw when req.payload is missing instead of falling back`**
   - Location: `tests/unit/collections/exercises-hooks.test.ts`  
   - What it tests: Calling `generateSlug` with `req: undefined` and a title+lesson should throw an error instead of silently creating a standalone instance
   - Why it fails NOW: Current code falls back to `getPayloadInstance()` and succeeds silently. After fix, it should throw.

3. **Test: `validateSlugUniqueness should throw when req.payload is missing instead of falling back`**
   - Location: `tests/unit/collections/exercises-hooks.test.ts`
   - What it tests: Calling `validateSlugUniqueness` with `req: undefined` should throw
   - Why it fails NOW: Current code falls back to `getPayloadInstance()` and succeeds. After fix, it should throw.

4. **Remove/Replace existing fallback tests**:
   - Remove `describe('fallback to getPayloadInstance (FR-003 guardrail)')` block (lines 264-299)
   - Replace with the new "throws when req.payload is missing" tests above

**Test Details** (pseudo-test, build agent writes actual code):

```typescript
// NEW: Reproduction test — currently PASSES (wrong behavior), should FAIL after we write it, PASS after fix
describe('transaction safety - no standalone fallback', () => {
  it('generateSlug throws when req.payload is missing', async () => {
    // No req.payload → should throw, not silently use getPayloadInstance
    await expect(
      generateSlug(createHookArgs({
        siblingData: { title: 'Test Exercise', lesson: 'lesson-1' },
        req: undefined,
      }))
    ).rejects.toThrow(/req\.payload/)
  })

  it('validateSlugUniqueness throws when req.payload is missing', async () => {
    await expect(
      validateSlugUniqueness(createHookArgs({
        value: 'test-slug',
        siblingData: { lesson: 'lesson-1' },
        req: undefined,
      }))
    ).rejects.toThrow(/req\.payload/)
  })

  it('generateSlug never calls getPayload standalone', async () => {
    const mockFind = vi.fn().mockResolvedValue({ docs: [] })
    const mockReq = { payload: { find: mockFind } }
    
    await generateSlug(createHookArgs({
      siblingData: { title: 'Test', lesson: 'lesson-1' },
      req: mockReq,
    }))

    // getPayload (module mock) should NEVER be called
    expect(mockGetPayload).not.toHaveBeenCalled()
  })

  it('validateSlugUniqueness never calls getPayload standalone', async () => {
    const mockFind = vi.fn().mockResolvedValue({ docs: [] })
    const mockReq = { payload: { find: mockFind } }
    
    await validateSlugUniqueness(createHookArgs({
      value: 'test-slug',
      siblingData: { lesson: 'lesson-1' },
      req: mockReq,
    }))

    expect(mockGetPayload).not.toHaveBeenCalled()
  })
})
```

**Acceptance Criteria**:
- [ ] "throws when req.payload is missing" tests exist for both hooks
- [ ] "never calls getPayload standalone" tests exist for both hooks
- [ ] Old "fallback to getPayloadInstance" tests are removed
- [ ] All other existing tests still pass (20 tests minus 2 removed + 4 new = 22 tests)
- [ ] New "throws" tests FAIL before the code fix is applied (they expect throw, but current code falls back)
- [ ] Run command: `pnpm vitest run tests/unit/collections/exercises-hooks.test.ts --config vitest.config.unit.mts`

**Estimated Time**: 10-15 minutes

---

### Step 2: Remove `getPayloadInstance()` and Use `req.payload` Directly

**Root Cause**: The `getPayloadInstance()` function (lines 7-11) and the fallback pattern `req?.payload ?? (await getPayloadInstance())` (lines 31, 80) allow hooks to silently bypass transaction safety.

**Files to Touch**:
- `src/server/payload/collections/Exercises/hooks.ts` (MODIFIED — lines 1-11, 31, 80)

**Fix**:

1. **Delete `getPayloadInstance()` function** (lines 7-11) — remove the entire function
2. **Remove the `payload` import** if no longer needed (dynamic imports of `payload` and `@payload-config` on lines 8-9)
3. **Line 31**: Replace `const payload = req?.payload ?? (await getPayloadInstance())` with direct use of `req.payload`. Add a guard that throws a descriptive error if `req?.payload` is falsy:
   ```typescript
   if (!req?.payload) {
     throw new Error('generateSlug hook requires req.payload for transaction safety')
   }
   ```
   Then use `req.payload` directly in the `find()` calls below.
4. **Line 80**: Same pattern for `validateSlugUniqueness`:
   ```typescript
   if (!req?.payload) {
     throw new Error('validateSlugUniqueness hook requires req.payload for transaction safety')
   }
   ```
   Then use `req.payload` directly.
5. **Keep `req` in find() calls** — lines 51 and 95 already pass `req`, which is correct. No change needed there.

**Verification**:
- Run reproduction tests from Step 1 → "throws when req.payload is missing" tests now PASS
- Run all existing tests → all PASS (the ones using `req.payload` mock still work)
- Run `pnpm -s tsc --noEmit` → no type errors
- Run command: `pnpm vitest run tests/unit/collections/exercises-hooks.test.ts --config vitest.config.unit.mts`

**Acceptance Criteria**:
- [ ] `getPayloadInstance()` function is completely removed from hooks.ts
- [ ] No imports of `payload` or `@payload-config` remain in hooks.ts (unless needed for types)
- [ ] `generateSlug` throws descriptive error when `req.payload` is missing
- [ ] `validateSlugUniqueness` throws descriptive error when `req.payload` is missing
- [ ] Both hooks use `req.payload` directly for all `find()` calls
- [ ] Both hooks still pass `req` to `find()` calls for transaction atomicity
- [ ] `pnpm -s tsc --noEmit` passes with no errors
- [ ] All unit tests pass: `pnpm vitest run tests/unit/collections/exercises-hooks.test.ts --config vitest.config.unit.mts`

**Estimated Time**: 10 minutes

---

### Step 3: Final Validation — Typecheck, Lint, and Import Map

**Files to Touch**: None (validation only)

**Commands**:
```bash
# Type check entire project
pnpm -s tsc --noEmit

# Lint check
pnpm -s lint

# Run full unit test suite to ensure no regressions
pnpm vitest run --config vitest.config.unit.mts

# Run the specific test file
pnpm vitest run tests/unit/collections/exercises-hooks.test.ts --config vitest.config.unit.mts
```

**Acceptance Criteria**:
- [ ] `pnpm -s tsc --noEmit` exits with code 0
- [ ] `pnpm -s lint` exits with code 0 (or only pre-existing warnings)
- [ ] All unit tests pass
- [ ] No new test failures in other test files

**Estimated Time**: 5 minutes

---

## Test Command Reference

```bash
# Unit tests for this file specifically
pnpm vitest run tests/unit/collections/exercises-hooks.test.ts --config vitest.config.unit.mts

# All unit tests
pnpm vitest run --config vitest.config.unit.mts

# Type checking
pnpm -s tsc --noEmit
```

## Files Changed Summary

| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `src/server/payload/collections/Exercises/hooks.ts` | MODIFIED | 7-11 (delete), 31, 80 | Remove `getPayloadInstance()`, use `req.payload` directly with fail-fast guard |
| `tests/unit/collections/exercises-hooks.test.ts` | MODIFIED | 264-299 (replace) | Remove fallback tests, add transaction-safety reproduction tests |

## Risk Assessment

- **Low risk**: The fix is minimal — removing a function and a fallback pattern
- **Payload guarantees `req`**: Payload CMS always passes `req` to field hooks, so the guard should never fire in production
- **Backward compatible**: No API changes, no schema changes, no new dependencies
- **Existing tests preserved**: 18 of 20 existing tests remain unchanged; 2 replaced with 4 new ones
