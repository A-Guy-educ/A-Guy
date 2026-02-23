# Plan: 260223-auto-62 — Fix Exercise Slug Generation Infinite Loop & Transaction Safety

## Summary

The `Exercises` collection's `generateSlug` hook uses an unbounded `while(true)` loop that can cause infinite loops or excessive DB queries. Additionally, both `generateSlug` and `validateSlugUniqueness` hooks use a standalone `getPayloadInstance()` helper instead of the `req.payload` from hook arguments, violating transaction safety.

**Bug 1 (FR-001, FR-002)**: `while(true)` loop in `generateSlug` has no upper bound → infinite loop risk.
**Bug 2 (FR-003, FR-004)**: Both hooks use `getPayloadInstance()` instead of `req.payload` → breaks transaction atomicity and bypasses proper access control scoping.
**Bug 3 (NFR-001)**: `find()` calls lack `depth: 0` → unnecessary relationship resolution during existence checks.

**File under fix**: `src/server/payload/collections/Exercises/hooks.ts` (92 lines)

---

## Step 1: Add MAX_SLUG_ATTEMPTS Constant and Cap the Loop

**Root Cause**: The `while(true)` loop at line 35 of `hooks.ts` has no termination condition other than finding a unique slug. If thousands of exercises share the same title in a lesson, this loops indefinitely making one DB query per iteration.

**Files to Touch**:
- `src/server/payload/collections/Exercises/hooks.ts` (MODIFIED — lines 1-57)
- `tests/unit/hooks/exercise-slug-hooks.test.ts` (NEW)

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/hooks/exercise-slug-hooks.test.ts`
- Test name: `generateSlug throws Error when MAX_SLUG_ATTEMPTS is exceeded`
- What it tests: Mock `req.payload.find()` to always return a doc (i.e., slug always taken). Call `generateSlug` with a title and lessonId. Expect it to throw an Error containing "unique slug" and "attempts".
- Why it fails now: The current code has `while(true)` with no limit — the test would hang forever (timeout), never throwing the expected error.

**Additional test** (MUST FAIL before fix):
- Test name: `generateSlug increments slug up to MAX_SLUG_ATTEMPTS - 1 before finding unique`
- What it tests: Mock `req.payload.find()` to return a conflicting doc for the first 49 calls, then return empty on the 50th. Verify the function returns `base-slug-49` (or whatever the counter reaches). This validates the loop still works correctly within the bounded limit.
- Why it fails now: Current code doesn't accept `req` from hook args (see Step 2), so any test using `req.payload` would fail.

**Fix**:
1. Add `const MAX_SLUG_ATTEMPTS = 50` at top of file (line 4, after imports) — **NFR-002**
2. Replace `while (true)` (line 35) with `while (counter <= MAX_SLUG_ATTEMPTS)` 
3. After the while loop, if we exited without `break` (i.e., counter > MAX_SLUG_ATTEMPTS), throw `new Error(\`Could not generate a unique slug after ${MAX_SLUG_ATTEMPTS} attempts for title "${title}" in lesson "${lessonId}"\`)`
4. **Important**: Keep counter starting at 1 and the first iteration using `baseSlug` (no suffix), then `baseSlug-1`, `baseSlug-2`, etc. The loop structure should be:
   ```
   let slug = baseSlug
   let counter = 1
   while (counter <= MAX_SLUG_ATTEMPTS) {
     // ... existing find + break logic ...
     slug = `${baseSlug}-${counter}`
     counter++
   }
   // If we get here, all attempts exhausted
   throw new Error(...)
   ```

**Acceptance Criteria**:
- [ ] `MAX_SLUG_ATTEMPTS` constant is defined at top of file with value `50` (FR-001, NFR-002)
- [ ] Loop is bounded by `MAX_SLUG_ATTEMPTS` (FR-001)
- [ ] Error is thrown with descriptive message when limit reached (FR-002)
- [ ] Normal slug generation (no conflicts) still works (returns base slug)
- [ ] Slug generation with conflicts works (returns `slug-N` for N < MAX_SLUG_ATTEMPTS)
- [ ] Updating own document still short-circuits (doesn't increment)

---

## Step 2: Replace `getPayloadInstance()` with `req.payload` for Transaction Safety

**Root Cause**: Both `generateSlug` (line 23) and `validateSlugUniqueness` (line 69) call `getPayloadInstance()` which creates a fresh Payload instance outside the current transaction context. This means the uniqueness check runs in a separate transaction, which can cause data corruption under concurrent writes.

**Files to Touch**:
- `src/server/payload/collections/Exercises/hooks.ts` (MODIFIED — lines 5-9 remove helper, lines 11/23/59/69/77 use req)
- `tests/unit/hooks/exercise-slug-hooks.test.ts` (MODIFIED — add tests)

**Reproduction Test** (MUST FAIL before fix):
- Test name: `generateSlug uses req.payload instead of standalone instance`
- What it tests: Provide a mock `req` with `req.payload.find` spy. Call the hook. Assert `req.payload.find` was called (not a standalone payload). Before fix, the hook ignores `req` entirely.
- Why it fails now: Current `generateSlug` signature destructures `{ value, operation, originalDoc, siblingData }` — it doesn't destructure `req`, so the mock `req.payload.find` is never called.

**Additional test**:
- Test name: `validateSlugUniqueness uses req.payload and passes req for transaction safety`
- What it tests: Provide mock `req` with `req.payload.find` spy. Call `validateSlugUniqueness`. Assert `req.payload.find` was called with `req` in the options object.
- Why it fails now: Same reason — `req` is not destructured from hook args.

**Fix**:
1. Delete the `getPayloadInstance()` helper function (lines 5-9)
2. Update `generateSlug` signature to destructure `req`: `async ({ value, operation, originalDoc, siblingData, req })`
3. Replace `const payload = await getPayloadInstance()` (line 23) with direct use of `req.payload`
4. Update all `req.payload.find()` calls in `generateSlug` to pass `req` and `overrideAccess: true` and `depth: 0`:
   ```typescript
   const existing = await req.payload.find({
     collection: 'exercises',
     where: { ... },
     limit: 1,
     req,
     overrideAccess: true,
     depth: 0,
   })
   ```
5. Update `validateSlugUniqueness` signature to destructure `req`: `async ({ value, operation, originalDoc, siblingData, req })`
6. Replace `const payload = await getPayloadInstance()` (line 69) with direct use of `req.payload`
7. Update the `req.payload.find()` call in `validateSlugUniqueness` to pass `req`, `overrideAccess: true`, and `depth: 0`:
   ```typescript
   const existing = await req.payload.find({
     collection: 'exercises',
     where: { ... },
     limit: 2,
     req,
     overrideAccess: true,
     depth: 0,
   })
   ```

**Acceptance Criteria**:
- [ ] `getPayloadInstance()` helper is removed from the file (AC from spec)
- [ ] `req` is destructured from hook arguments in both hooks (FR-003)
- [ ] `req.payload.find()` is used instead of standalone `payload.find()` (FR-003)
- [ ] `req` is passed as option to all `find()` calls for transaction safety (FR-003)
- [ ] `overrideAccess: true` is explicitly passed to all `find()` calls (FR-004)
- [ ] `depth: 0` is passed to all `find()` calls (NFR-001)
- [ ] `limit: 1` preserved in `generateSlug`, `limit: 2` preserved in `validateSlugUniqueness` (Guardrail)
- [ ] `validateSlugUniqueness` still throws when duplicate slug found in different doc

---

## Step 3: Comprehensive Integration Tests for Both Hooks Together

**Files to Touch**:
- `tests/unit/hooks/exercise-slug-hooks.test.ts` (MODIFIED — add edge case tests)

**Tests** (all should PASS after Steps 1 & 2):

1. **`generateSlug returns base slug when no conflict exists`**
   - Mock `req.payload.find` to return `{ docs: [] }` on first call
   - Call `generateSlug` with title "My Exercise" and a lessonId
   - Expect returned slug to be `formatSlug("My Exercise")`

2. **`generateSlug returns value unchanged on delete operation`**
   - Call with `operation: 'delete'` and existing value
   - Expect value returned unchanged, no DB queries

3. **`generateSlug returns formatted slug when no lessonId`**
   - Call with title but no lessonId (no siblingData.lesson, no originalDoc.lesson)
   - Expect `formatSlug(title)` returned without any DB queries

4. **`generateSlug skips self-match on update operation`**
   - Mock `req.payload.find` to return a doc with same ID as `originalDoc.id`
   - Call with `operation: 'update'` and existing originalDoc
   - Expect same slug returned (no increment)

5. **`generateSlug appends counter when conflict found`**
   - Mock `req.payload.find`: first call returns a conflicting doc (different ID), second call returns empty
   - Expect returned slug to be `base-slug-1`

6. **`validateSlugUniqueness passes when no conflict`**
   - Mock `req.payload.find` returns `{ docs: [] }`
   - Expect value returned unchanged

7. **`validateSlugUniqueness throws on duplicate slug in same lesson`**
   - Mock `req.payload.find` returns a doc with different ID
   - Expect Error thrown: "An exercise with this slug already exists in this lesson"

8. **`validateSlugUniqueness passes when match is self (update)`**
   - Mock `req.payload.find` returns doc with same ID as originalDoc
   - Expect value returned unchanged (no error)

9. **`both hooks pass overrideAccess: true and depth: 0 to find()`**
   - Spy on `req.payload.find` call args
   - Verify `overrideAccess: true` and `depth: 0` present in every call

**Acceptance Criteria**:
- [ ] All 9+ tests pass
- [ ] No test calls `getPayloadInstance()` (it doesn't exist anymore)
- [ ] Tests use mocked `req.payload.find` — no real DB needed
- [ ] Edge cases covered: delete operation, no title, no lessonId, self-match, max attempts

---

## Test Infrastructure Notes

- **Test file**: `tests/unit/hooks/exercise-slug-hooks.test.ts` (NEW file)
- **Run command**: `pnpm vitest run tests/unit/hooks/exercise-slug-hooks.test.ts --config vitest.config.unit.mts`
- **Pattern**: Follow `tests/unit/hooks/inferMediaType.test.ts` pattern for mock `req` creation
- **Mock strategy**: Create a `createMockReq()` helper that returns a mock `req` object with `req.payload.find` as a `vi.fn()`. Use `mockResolvedValueOnce` to queue different responses for sequential `find()` calls.
- **Import**: Import hooks directly: `import { generateSlug, validateSlugUniqueness } from '@/server/payload/collections/Exercises/hooks'`
- **Import**: Import formatSlug for assertions: `import { formatSlug } from '@/server/payload/collections/Exercises/formatSlug'`

## Spec Requirements Traceability

| Requirement | Plan Step | Test |
|-------------|-----------|------|
| FR-001: Cap slug attempts | Step 1 | `throws Error when MAX_SLUG_ATTEMPTS exceeded` |
| FR-002: Error on max attempts | Step 1 | `throws Error when MAX_SLUG_ATTEMPTS exceeded` |
| FR-003: Use `req` for transaction safety | Step 2 | `uses req.payload instead of standalone instance` |
| FR-004: `overrideAccess: true` | Step 2 | `pass overrideAccess: true and depth: 0` |
| NFR-001: `depth: 0` | Step 2 | `pass overrideAccess: true and depth: 0` |
| NFR-002: Constant at top of file | Step 1 | Visual/structural — constant defined at module scope |
| Guardrail: Keep limit values | Step 2 | Verified via spy assertions on find() args |
| Guardrail: Don't alter formatSlug | All | formatSlug.ts is never touched |

## Assumptions

1. `MAX_SLUG_ATTEMPTS = 50` is the recommended value per spec.
2. The `FieldHook` type from Payload includes `req` in its arguments (standard in Payload 3.x).
3. No other code imports or uses `getPayloadInstance()` from this file — it's safe to remove.
4. The `formatSlug` function in `./formatSlug.ts` is not modified (per guardrails).
5. Unit tests with mocked `req.payload.find` are sufficient — no integration test with real DB needed for this fix.
