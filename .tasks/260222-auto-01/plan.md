# Plan: 260222-auto-01 — Bound Slug Generation Loop & Transaction Safety

## Summary

The `generateSlug` field hook in `src/server/payload/collections/Exercises/hooks.ts` uses an unbounded `while (true)` loop that can cause infinite loops or excessive DB queries. We will:

1. Add a `MAX_SLUG_ATTEMPTS = 100` safety constant and enforce it in the loop
2. Throw a descriptive error when attempts are exhausted
3. Migrate both `generateSlug` and `validateSlugUniqueness` from `getPayloadInstance()` to `req.payload.find()` for transaction safety (with fallback)

## Assumptions

- `FieldHook` type from Payload 3.x provides `req` in its arguments (it does — it's a standard hook argument)
- Unit tests will mock `req.payload.find` directly rather than mocking `getPayload` + `@payload-config`
- The `formatSlug` utility is unmodified and continues to work as-is
- Tests go in `tests/unit/collections/exercises-hooks.test.ts` (new file) following existing test patterns

---

## Step 1: Add Unit Tests for Slug Generation Bug & Transaction Safety

**Time estimate**: 15 minutes

**Files to Touch**:
- `tests/unit/collections/exercises-hooks.test.ts` (NEW)

**Behavior**: Create a comprehensive test file that covers:
1. **Reproduction test for the infinite loop bug** (FR-001, FR-002, NFR-001): Mock `req.payload.find` to always return a conflicting document (never empty). Call `generateSlug` with this mock. Before the fix, this would hang forever. After the fix, it must throw an error mentioning "100 attempts".
2. **Test for transaction safety** (FR-003): Verify `generateSlug` calls `req.payload.find` (not `getPayloadInstance`) when `req` is available, and passes `req` and `depth: 0`.
3. **Test for fallback** (FR-003 guardrail): Verify that when `req` is undefined, `getPayloadInstance()` is used as fallback.
4. **Test for normal slug generation**: Verify that when no conflict exists, the base slug is returned unchanged.
5. **Test for incremented slug**: Verify that when slug conflicts exist for iteration 1 but not iteration 2, the returned slug has `-1` appended.

**Tests that FAIL before fix, PASS after**:

### Test 1: Infinite loop protection
```
it('throws an error after MAX_SLUG_ATTEMPTS when slug is never unique', async () => {
  // Mock req.payload.find to always return a conflicting doc
  // Call generateSlug with title='Test', lessonId='lesson-1'
  // Expect: throws Error matching /Unable to generate unique slug after 100 attempts/
  // Before fix: HANGS FOREVER (timeout)
  // After fix: PASSES (throws within milliseconds)
})
```

### Test 2: Uses req.payload.find with req and depth: 0
```
it('uses req.payload.find for transaction safety when req is available', async () => {
  // Mock req.payload.find to return empty docs
  // Call generateSlug with req object
  // Expect: req.payload.find was called with { req, depth: 0, ... }
  // Before fix: FAILS (uses getPayloadInstance instead)
  // After fix: PASSES
})
```

**Acceptance Criteria**:
- [ ] Test file `tests/unit/collections/exercises-hooks.test.ts` exists
- [ ] Test for infinite loop protection is written and FAILS before code change (hangs/times out)
- [ ] Test for `req.payload.find` usage is written and FAILS before code change
- [ ] Test for normal slug generation passes (existing behavior preserved)
- [ ] Test for incremented slug generation passes (existing behavior preserved)
- [ ] Test for req fallback to getPayloadInstance when req is undefined
- [ ] Tests mock `payload` and `@payload-config` modules like existing test patterns
- [ ] Run: `pnpm test:unit -- tests/unit/collections/exercises-hooks.test.ts`

---

## Step 2: Fix generateSlug — Bound the Loop and Use req.payload

**Time estimate**: 15 minutes

**Files to Touch**:
- `src/server/payload/collections/Exercises/hooks.ts` (MODIFIED — lines 1-57)

**Root Cause**: The `while (true)` loop on line 35 has no exit condition other than finding a unique slug. If thousands of exercises share the same title+lesson combo, the loop runs indefinitely.

**Exact Changes**:

1. **Add constant** (top of file, after imports):
   ```typescript
   const MAX_SLUG_ATTEMPTS = 100
   ```

2. **Modify `generateSlug` signature** (line 11): Destructure `req` from the hook arguments:
   ```typescript
   export const generateSlug: FieldHook = async ({ value, operation, originalDoc, siblingData, req }) => {
   ```

3. **Replace `getPayloadInstance()` call** (line 23): Use `req.payload` with fallback:
   ```typescript
   const payload = req?.payload ?? (await getPayloadInstance())
   ```

4. **Bound the loop** (lines 35-54): Replace `while (true)` with `while (counter <= MAX_SLUG_ATTEMPTS)`:
   ```typescript
   while (counter <= MAX_SLUG_ATTEMPTS) {
     const existing = await payload.find({
       collection: 'exercises',
       where: {
         and: [{ lesson: { equals: lessonId } }, { slug: { equals: slug } }],
       },
       limit: 1,
       depth: 0,
       req,   // transaction safety
     })
     // ... existing break conditions ...
     slug = `${baseSlug}-${counter}`
     counter++
   }
   ```

5. **Add error throw after loop** (after the while block):
   ```typescript
   // If we exit the loop without breaking, all attempts were exhausted
   throw new Error(`Unable to generate unique slug after ${MAX_SLUG_ATTEMPTS} attempts`)
   ```
   
   **Important implementation note**: The loop logic needs restructuring. Currently `counter` starts at 1 and only increments when a conflict is found. With the bounded loop `while (counter <= MAX_SLUG_ATTEMPTS)`, the first iteration checks `baseSlug` (no counter appended). If it conflicts, `slug = baseSlug-1` and `counter` becomes 2. If we reach `counter > MAX_SLUG_ATTEMPTS` without breaking, throw. The restructured approach:
   
   ```typescript
   let slug = baseSlug
   let counter = 1

   for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
     const existing = await payload.find({ ... })
     if (existing.docs.length === 0) return slug
     if (originalDoc?.id && existing.docs[0]?.id === originalDoc.id) return slug
     slug = `${baseSlug}-${counter}`
     counter++
   }
   throw new Error(`Unable to generate unique slug after ${MAX_SLUG_ATTEMPTS} attempts`)
   ```

**Reproduction Test** (from Step 1):
- Test: `generateSlug throws after MAX_SLUG_ATTEMPTS when slug is never unique`
- Why it fails before: `while (true)` never exits → test times out
- After fix: loop exits after 100 iterations → throws error → test passes

**Verification**:
- Run: `pnpm test:unit -- tests/unit/collections/exercises-hooks.test.ts`
- All tests from Step 1 should now PASS
- Run: `pnpm -s tsc --noEmit` — no type errors

**Acceptance Criteria**:
- [ ] `MAX_SLUG_ATTEMPTS` constant is exported or defined at module level, set to `100`
- [ ] `generateSlug` destructures `req` from hook arguments (FR-003)
- [ ] `generateSlug` uses `req?.payload ?? (await getPayloadInstance())` (FR-003 + fallback)
- [ ] The `payload.find()` call inside the loop passes `req` and `depth: 0` (FR-003)
- [ ] The loop is bounded to `MAX_SLUG_ATTEMPTS` iterations (FR-001)
- [ ] An `Error` is thrown with message matching `Unable to generate unique slug after 100 attempts` when limit exceeded (FR-002)
- [ ] The slug generation strategy is unchanged: `baseSlug`, then `baseSlug-1`, `baseSlug-2`, etc. (Guardrail)
- [ ] Existing slug uniqueness logic is preserved (self-update detection via `originalDoc.id`)
- [ ] `overrideAccess` is NOT explicitly set (defaults to `true` as required by Guardrail)
- [ ] TypeScript compiles cleanly: `pnpm -s tsc --noEmit`

---

## Step 3: Fix validateSlugUniqueness — Use req.payload

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/server/payload/collections/Exercises/hooks.ts` (MODIFIED — lines 59-92)

**Exact Changes**:

1. **Modify `validateSlugUniqueness` signature** (line 59): Destructure `req`:
   ```typescript
   export const validateSlugUniqueness: FieldHook = async ({ value, operation, originalDoc, siblingData, req }) => {
   ```

2. **Replace `getPayloadInstance()` call** (line 69):
   ```typescript
   const payload = req?.payload ?? (await getPayloadInstance())
   ```

3. **Add `req` and `depth: 0`** to the `.find()` call (lines 77-83):
   ```typescript
   const existing = await payload.find({
     collection: 'exercises',
     where: {
       and: [{ lesson: { equals: lessonId } }, { slug: { equals: value } }],
     },
     limit: 2,
     depth: 0,
     req,
   })
   ```

**Tests that FAIL before, PASS after**:

### Test 3: validateSlugUniqueness uses req.payload
```
it('validateSlugUniqueness uses req.payload.find with req and depth: 0', async () => {
  // Mock req.payload.find to return empty docs
  // Call validateSlugUniqueness
  // Expect: req.payload.find called with { req, depth: 0, ... }
  // Before fix: FAILS (uses getPayloadInstance)
  // After fix: PASSES
})
```

### Test 4: validateSlugUniqueness throws on duplicate slug (existing behavior preserved)
```
it('validateSlugUniqueness throws when duplicate slug exists in lesson', async () => {
  // Mock req.payload.find to return a doc with different id
  // Expect: throws 'An exercise with this slug already exists in this lesson'
})
```

**Verification**:
- Run: `pnpm test:unit -- tests/unit/collections/exercises-hooks.test.ts`
- All tests PASS
- Run: `pnpm -s tsc --noEmit` — no type errors

**Acceptance Criteria**:
- [ ] `validateSlugUniqueness` destructures `req` from hook arguments (FR-004)
- [ ] Uses `req?.payload ?? (await getPayloadInstance())` (FR-004 + fallback)
- [ ] The `.find()` call passes `req` and `depth: 0` (FR-004)
- [ ] Existing error-throwing behavior preserved (duplicate slug detection)
- [ ] TypeScript compiles cleanly

---

## Step 4: Final Quality Gates

**Time estimate**: 5 minutes

**Files to Touch**: None (validation only)

**Commands**:
```bash
pnpm test:unit -- tests/unit/collections/exercises-hooks.test.ts
pnpm -s tsc --noEmit
pnpm -s lint
```

**Acceptance Criteria**:
- [ ] All unit tests pass
- [ ] TypeScript compiles with no errors
- [ ] Linter passes (or only pre-existing warnings)
- [ ] `getPayloadInstance()` is still importable but only used as fallback (not removed — other code may depend on it)

---

## Test File Structure

```
tests/unit/collections/exercises-hooks.test.ts
├── describe('generateSlug')
│   ├── it('returns value unchanged on delete operation')
│   ├── it('returns existing value when no title provided')
│   ├── it('returns formatted slug when no lessonId')
│   ├── it('returns base slug when no conflict exists')
│   ├── it('appends counter when slug conflicts exist')
│   ├── it('returns base slug when conflict is own document (update)')
│   ├── it('throws after MAX_SLUG_ATTEMPTS when slug is never unique')  ← BUG REPRO
│   ├── it('uses req.payload.find with req and depth:0')  ← TRANSACTION SAFETY
│   └── it('falls back to getPayloadInstance when req is undefined')
├── describe('validateSlugUniqueness')
│   ├── it('returns value unchanged on delete operation')
│   ├── it('returns value when no lessonId')
│   ├── it('returns value when no duplicates found')
│   ├── it('throws when duplicate slug exists in same lesson')
│   ├── it('allows same slug for own document (update)')
│   ├── it('uses req.payload.find with req and depth:0')  ← TRANSACTION SAFETY
│   └── it('falls back to getPayloadInstance when req is undefined')
```

## Mocking Strategy

Both hooks currently import `getPayloadInstance` (internal function) and will now also use `req.payload`. The test will:

1. Mock `payload` and `@payload-config` modules (same pattern as `tests/unit/queries/exercises.test.ts`)
2. Create a mock `req` object with `req.payload.find` as a `vi.fn()`
3. For fallback tests, pass `req: undefined` and verify `getPayloadInstance` is called

```typescript
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

const mockFind = vi.fn()
const mockReq = {
  payload: { find: mockFind },
  // other req properties as needed
}
```

## Requirement Traceability

| Requirement | Step | Test |
|-------------|------|------|
| FR-001: Bounded slug generation | Step 2 | `throws after MAX_SLUG_ATTEMPTS` |
| FR-002: Error on exceeding limits | Step 2 | `throws after MAX_SLUG_ATTEMPTS` |
| FR-003: Transaction safety (generateSlug) | Step 2 | `uses req.payload.find with req and depth:0` |
| FR-003: Fallback to getPayloadInstance | Step 2 | `falls back to getPayloadInstance` |
| FR-004: Transaction safety (validateSlugUniqueness) | Step 3 | `uses req.payload.find with req and depth:0` |
| NFR-001: System stability | Step 2 | `throws after MAX_SLUG_ATTEMPTS` (proves loop terminates) |
