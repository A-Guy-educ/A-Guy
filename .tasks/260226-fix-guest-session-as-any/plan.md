# Plan: Fix Guest Sessions Type Safety

**Task ID**: 260226-fix-guest-session-as-any
**Task Type**: fix_bug
**Spec Requirements**: FR-1, FR-2, FR-3

## Summary

The `guest-session.ts` service defines a **manual `GuestSessionDoc` interface** (lines 23–35) that diverges from the auto-generated `GuestSession` type in `payload-types.ts`. This causes:

1. **Type casts everywhere**: 7× `as unknown as GuestSessionDoc` / `as GuestSessionDoc` casts in the service file (the original `as any` casts from the spec were already partially fixed to `as const` for the collection slug, but the doc-level type casts remain).
2. **Missing fields**: The manual `GuestSessionDoc` lacks `ipHash`, `userAgentHash` (optional), and `updatedAt`; and types `claimedByUser` as `string` instead of `(string | null) | User`.
3. **Failing typecheck test**: `tests/unit/server/services/guest-session.typecheck.test.ts` has 9 TypeScript errors because `GuestSessionDoc ≠ GuestSession`.
4. **Secondary file**: `guest-sessions-cleanup.ts` has its own manual `GuestSessionDocument` interface with a wrong status enum (`'claimed'` instead of `'revoked'`).

**Root Cause**: The custom `GuestSessionDoc` interface was written before the collection existed in the type registry. Now that `GuestSessions` is properly registered in `payload.config.ts` and `payload-types.ts` includes the generated `GuestSession` type, the manual interface and all type casts can be removed.

## Assumptions

- The `payload-types.ts` file is already up-to-date (the `GuestSession` interface exists at line 1098). If the build agent finds it's stale, run `pnpm generate:types` first.
- The `'guest-sessions' as const` usage on collection slugs is valid TypeScript and will pass once the doc types align. No changes needed for those.
- The test file at `tests/unit/server/services/guest-session.typecheck.test.ts` was written as the **regression test for this bug** — it should PASS after the fix.

---

### Step 1: Replace GuestSessionDoc with GuestSession type alias

**Root Cause**: `GuestSessionDoc` is a manually-defined interface that diverges from the auto-generated `GuestSession` type. It's missing `ipHash?`, `userAgentHash?`, `updatedAt`, and has `claimedByUser?: string` instead of `(string | null) | User`.

**Files to Touch**:
- `src/server/services/guest-session.ts` (MODIFIED — lines 16, 23–35)

**Reproduction Test**: The existing test already demonstrates this bug:
- Test location: `tests/unit/server/services/guest-session.typecheck.test.ts`
- Test: `GuestSessionDoc should be identical to GuestSession` (line 28–31)
- Why it fails: `expectTypeOf<GuestSessionDoc>().toEqualTypeOf<GuestSession>()` fails because the interfaces have different shapes

**Fix**:
1. Add import: `import type { GuestSession } from '@/payload-types'` (line 16)
2. Replace the entire `GuestSessionDoc` interface (lines 23–35) with: `export type GuestSessionDoc = GuestSession`
3. This makes `GuestSessionDoc` a type alias — all existing code that references it continues to work, the export name is preserved for backward compatibility, and the type test passes.

**Verification**:
- Run `pnpm vitest run tests/unit/server/services/guest-session.typecheck.test.ts` → first test PASSES
- Remaining tests in that file still fail (fixed in Step 2)

**Acceptance Criteria**:
- [ ] `GuestSessionDoc` is exported as `type GuestSessionDoc = GuestSession`
- [ ] No manual interface definition remains
- [ ] Import of `GuestSession` from `@/payload-types` exists

---

### Step 2: Remove all type casts from guest-session.ts

**Root Cause**: Because `GuestSessionDoc` was a different type from what Payload's Local API returns, every call needed `as GuestSessionDoc` or `as unknown as GuestSessionDoc` casts. Now that `GuestSessionDoc = GuestSession`, the Payload API return types match directly and no casts are needed.

**Files to Touch**:
- `src/server/services/guest-session.ts` (MODIFIED — lines 168, 187, 205, 209, 230, 248, 273)

**Reproduction Test**: The existing typecheck test covers this:
- Test location: `tests/unit/server/services/guest-session.typecheck.test.ts`
- Tests: lines 33–51 (return type assertions for all functions)
- Why they fail: The `ReturnType` alias shadows the built-in `ReturnType` utility type, causing `TS2456: circularly references itself`. This is a bug **in the test file** that must also be fixed (see note below).

**Fix** (in `guest-session.ts`):
1. **Line 168**: Change `return { session: session as unknown as GuestSessionDoc, token }` → `return { session, token }` (Payload `create()` returns the generated type directly)
2. **Line 187**: Change `const session = sessions.docs[0] as GuestSessionDoc` → `const session = sessions.docs[0]` (Payload `find()` returns typed docs)
3. **Line 205**: Change `(session as GuestSessionDoc).status` → `session.status` (findByID returns the typed doc)
4. **Line 209**: Remove `const doc = session as GuestSessionDoc` — use `session` directly on lines 210, 215
5. **Line 230**: Change `return updated as GuestSessionDoc` → `return updated`
6. **Line 248**: Change `return updated as GuestSessionDoc` → `return updated`
7. **Line 273**: Change `const doc = session as GuestSessionDoc` → use `session` directly on line 274

**Also fix the test file** (`tests/unit/server/services/guest-session.typecheck.test.ts`):
- Lines 34, 39, 44, 49: Rename the type alias from `ReturnType` to something like `CreateReturn`, `GetByTokenReturn`, `UpdateActivityReturn`, `RevokeReturn` to avoid shadowing the built-in `ReturnType<T>` utility type.

**Verification**:
- Run `pnpm vitest run tests/unit/server/services/guest-session.typecheck.test.ts` → ALL 5 tests PASS
- Run `pnpm -s tsc --noEmit 2>&1 | grep guest-session` → zero errors

**Acceptance Criteria**:
- [ ] Zero `as GuestSessionDoc` or `as unknown as GuestSessionDoc` casts in `guest-session.ts`
- [ ] Zero `as any` casts in `guest-session.ts`
- [ ] All 5 typecheck tests pass
- [ ] `tsc --noEmit` reports zero errors for guest-session files

---

### Step 3: Fix GuestSessionDocument type in cleanup endpoint

**Root Cause**: `guest-sessions-cleanup.ts` defines its own `GuestSessionDocument` interface (line 25–29) with an incorrect status enum value `'claimed'` (should be `'revoked'` per the collection config). It also lacks most fields.

**Files to Touch**:
- `src/server/payload/endpoints/cron/guest-sessions-cleanup.ts` (MODIFIED — lines 25–29, 52, 71, 139)

**Reproduction Test**:
- Test location: `tests/unit/server/services/guest-session.typecheck.test.ts` (add one test)
- New test: `GuestSessionDocument in cleanup should use generated type`
- Alternatively, a simple `tsc --noEmit` check validates that the import compiles. We can add a small type test in the existing test file:
  ```typescript
  it('cleanup endpoint should use GuestSession type', () => {
    // This test exists to ensure the cleanup endpoint doesn't define a separate type
    // Verified by the absence of a local GuestSessionDocument interface in cleanup.ts
  })
  ```
- **Primary verification**: `tsc --noEmit` passes and grep confirms no local `GuestSessionDocument` interface.

**Fix**:
1. Remove the local `interface GuestSessionDocument` (lines 25–29)
2. Add import: `import type { GuestSession } from '@/payload-types'`
3. Replace all `GuestSessionDocument` references with `GuestSession`:
   - Line 52: `Promise<{ docs: GuestSession[]; totalDocs: number }>`
   - Line 71: `docs: result.docs as GuestSession[]` → `docs: result.docs` (cast may be removable if overrideAccess is set)
   - Line 139: `session: GuestSession`

**Verification**:
- Run `pnpm -s tsc --noEmit 2>&1 | grep guest-sessions-cleanup` → zero errors
- Run `grep -n "interface GuestSessionDocument" src/server/payload/endpoints/cron/guest-sessions-cleanup.ts` → no matches

**Acceptance Criteria**:
- [ ] No local `GuestSessionDocument` interface in cleanup file
- [ ] Uses `GuestSession` from `@/payload-types`
- [ ] `tsc --noEmit` passes with zero errors for this file

---

### Step 4: Final verification — full typecheck and no remaining casts

**Files to Touch**: None (verification only)

**Verification Commands**:
```bash
# Full TypeScript compilation
pnpm -s tsc --noEmit

# Verify no 'as any' anywhere in guest session files
grep -rn "as any" src/server/services/guest-session.ts
# Expected: no output

# Verify no manual GuestSession interfaces (only type alias should exist)
grep -rn "interface GuestSession" src/server/services/guest-session.ts src/server/payload/endpoints/cron/guest-sessions-cleanup.ts
# Expected: no output

# Verify all type tests pass
pnpm vitest run tests/unit/server/services/guest-session.typecheck.test.ts
```

**Acceptance Criteria** (maps to spec):
- [ ] `pnpm generate:types` completes without errors (FR-1) — if needed
- [ ] GuestSessions collection appears in generated `payload-types.ts` (FR-2) — already true
- [ ] All `as any` / `as GuestSessionDoc` / `as unknown as GuestSessionDoc` casts removed from `guest-session.ts` (FR-3)
- [ ] TypeScript compilation passes: `pnpm -s tsc --noEmit` (spec AC)
- [ ] All typecheck tests pass
- [ ] Application runtime behavior unchanged (types-only change)

---

## Test Strategy

The **existing** test file `tests/unit/server/services/guest-session.typecheck.test.ts` was pre-written as the regression test for this exact bug. It contains 5 `expectTypeOf` assertions that will:

1. **FAIL before fix** — `GuestSessionDoc ≠ GuestSession`, and `ReturnType` alias shadows the built-in
2. **PASS after fix** — Once `GuestSessionDoc = GuestSession` and the `ReturnType` naming bug is fixed

No new test files need to be created. The test file itself needs a minor fix (rename `ReturnType` type aliases to avoid shadowing).

## Estimated Time

- Step 1: ~5 minutes
- Step 2: ~10 minutes
- Step 3: ~10 minutes
- Step 4: ~5 minutes
- **Total: ~30 minutes**
