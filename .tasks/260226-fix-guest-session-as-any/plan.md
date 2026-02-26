# Plan: Fix Type Safety in guest-session.ts

**Task ID**: 260226-fix-guest-session-as-any
**Task Type**: fix_bug
**Risk**: Low
**Estimated Time**: 10–15 minutes (1 step)

## Summary

The file `src/server/services/guest-session.ts` defines a custom `GuestSessionDoc` interface (lines 23–35) that duplicates the auto-generated `GuestSession` type from `src/payload-types.ts` (lines 1098–1149). This forces every Payload API return value to be cast through `as unknown as GuestSessionDoc` or `as GuestSessionDoc`, which is unsafe (`as unknown as X` is effectively `as any`). The fix is to import the generated type and drop the custom interface + casts.

## Assumptions

1. The `GuestSession` generated type (payload-types.ts:1098–1149) is a superset of `GuestSessionDoc` — **confirmed** by comparing fields. Generated type has all same fields plus `ipHash`, `userAgentHash`, `updatedAt` (which the custom type omits). The generated type uses `(string | null) | User` for `claimedByUser` vs plain `string` — this is expected for relationship fields and is correct.
2. No other file imports `GuestSessionDoc` from `guest-session.ts` — **confirmed** by grep.
3. The `'guest-sessions' as const` casts are harmless literal type narrowing and should stay per FR-5.
4. Existing tests use `as any` and `as unknown as` casts in mocks — these are test-level casts and don't need changing for this task.

---

### Step 1: Replace `GuestSessionDoc` with generated `GuestSession` type

**Root Cause**: A hand-written `GuestSessionDoc` interface forces unsafe `as unknown as GuestSessionDoc` casts on every Payload API call return value. The generated `GuestSession` type from `payload-types.ts` matches the actual runtime shape, making casts unnecessary.

**Files to Touch**:

- `src/server/services/guest-session.ts` (MODIFIED — lines 16, 23–35, 137, 168, 174, 187, 199, 205, 209, 230, 237, 248, 273)

**Exact Changes**:

1. **Add import** (line 16 area): Add `import type { GuestSession } from '@/payload-types'`
2. **Remove custom interface** (lines 23–35): Delete the entire `GuestSessionDoc` interface block.
3. **Update return types** — replace every `GuestSessionDoc` reference with `GuestSession`:
   - Line 137: `Promise<{ session: GuestSessionDoc; token: string }>` → `Promise<{ session: GuestSession; token: string }>`
   - Line 174: `Promise<GuestSessionDoc | null>` → `Promise<GuestSession | null>`
   - Line 199: `Promise<GuestSessionDoc | null>` → `Promise<GuestSession | null>`
   - Line 237: `Promise<GuestSessionDoc | null>` → `Promise<GuestSession | null>`
4. **Remove unsafe casts** — the Payload Local API already returns `GuestSession` when collection is `'guest-sessions'`:
   - Line 168: `session as unknown as GuestSessionDoc` → just `session` (payload.create returns the correct type)
   - Line 187: `sessions.docs[0] as GuestSessionDoc` → `sessions.docs[0]` (payload.find returns typed docs)
   - Line 205: `(session as GuestSessionDoc).status` → `session.status` (payload.findByID returns correct type)
   - Line 209: `const doc = session as GuestSessionDoc` → `const doc = session` (no cast needed)
   - Line 230: `updated as GuestSessionDoc` → just `updated`
   - Line 248: `updated as GuestSessionDoc` → just `updated`
   - Line 273: `const doc = session as GuestSessionDoc` → `const doc = session` (no cast needed)
5. **Keep** all `'guest-sessions' as const` casts (FR-5) — these provide literal type narrowing that helps Payload infer the return type.

**Reproduction Test** (verifies the bug exists):

- Test location: `tests/unit/server/services/guest-session-types.test.ts` (NEW)
- What it tests: The source file does NOT contain the string `GuestSessionDoc` and does NOT contain `as unknown as` casts
- Why it fails now: The current file has 12 occurrences of `GuestSessionDoc` and multiple `as unknown as` casts

```
Test 1: "guest-session.ts should not define a custom GuestSessionDoc interface"
  - Read source file, assert it does NOT contain "interface GuestSessionDoc"
  - FAILS before fix (interface exists on line 23)
  - PASSES after fix (interface removed)

Test 2: "guest-session.ts should not contain unsafe 'as unknown as' type casts"
  - Read source file, assert it does NOT contain "as unknown as"
  - FAILS before fix (line 168 has `as unknown as GuestSessionDoc`)
  - PASSES after fix (cast removed)

Test 3: "guest-session.ts should import GuestSession from payload-types"
  - Read source file, assert it contains import from '@/payload-types' with GuestSession
  - FAILS before fix (no such import)
  - PASSES after fix (import added)
```

**Verification**:

1. Run reproduction tests → all 3 FAIL before fix, PASS after
2. Run existing tests → `pnpm vitest run tests/unit/server/services/guest-session.test.ts` — all existing tests still pass (they use their own mocks/casts independent of source types)
3. Run TypeScript compiler → `pnpm tsc --noEmit` passes with zero errors
4. Run linter → `pnpm lint` passes

**Acceptance Criteria** (maps to spec):

- [x] FR-1: GuestSessions collection is in payload.config.ts (pre-verified, no change needed)
- [ ] FR-2: `GuestSession` type imported from `payload-types.ts` — verify import line exists
- [ ] FR-3: Custom `GuestSessionDoc` interface removed — verify no `interface GuestSessionDoc` in file
- [ ] FR-4: Unsafe type casts removed — verify no `as unknown as` and no `as GuestSessionDoc` in file
- [ ] FR-5: `'guest-sessions' as const` casts remain — verify they still exist in file
- [ ] Spec AC-6: `pnpm tsc --noEmit` passes clean

---

## Test Commands

```bash
# Run new reproduction tests
pnpm vitest run tests/unit/server/services/guest-session-types.test.ts

# Run existing tests (regression check)
pnpm vitest run tests/unit/server/services/guest-session.test.ts

# TypeScript compilation
pnpm tsc --noEmit

# Lint
pnpm lint
```

## Notes for Build Agent

- This is a single-file change. No other files import `GuestSessionDoc`.
- The factory file `tests/factories/guest-session.factory.ts` also has `'guest-sessions' as any` on line 73 — this is a **separate** issue and out of scope for this task.
- The cleanup endpoint `src/server/payload/endpoints/cron/guest-sessions-cleanup.ts` has its own `GuestSessionDocument` interface — also a **separate** issue, out of scope.
- The existing test file `guest-session.test.ts` uses `as any` and `as unknown as` in its mock setup — these are test-internal casts and should NOT be changed in this task.
- After removing the custom interface, if `tsc` reveals any type mismatch (e.g., `claimedByUser` being `string | User` vs `string`), the fix is to update the consuming code to handle the union type, NOT to add casts back.
