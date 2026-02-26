# Plan: Guest Session Type Safety Fix

**Task ID**: 260225-auto-90
**Task Type**: fix_bug
**Spec Requirements**: FR-1, FR-2, FR-3

## Rerun Context

This is a rerun. The previous run converted `'guest-sessions' as any` → `'guest-sessions' as const` on all 7 Payload operations, which fixed the original FR-3 `as any` issue. However, the previous build agent did **not** complete the cleanup of the redundant `GuestSessionDoc` interface and its 6 associated `as GuestSessionDoc` / `as unknown as GuestSessionDoc` type casts. These casts are unnecessary because `guest-sessions` IS already in `payload-types.ts` (line 77) and TypeScript currently compiles cleanly.

**What changed in this plan**:
- Kept the same overall approach as the previous plan
- Added much more explicit, line-by-line implementation details so the build agent can't miss any changes
- Combined Steps 2 and 3 from previous plan into Step 1 since they are trivially dependent
- Added a dedicated Step 2 for the `as const` removal (since `guest-sessions` is a known literal type in Config, `as const` is also unnecessary)

**Current state of the file**: `src/server/services/guest-session.ts` has:
- 7x `'guest-sessions' as const` (unnecessary since Payload types recognize the literal)
- 1x `export interface GuestSessionDoc` (redundant, duplicates generated `GuestSession`)
- 1x `as unknown as GuestSessionDoc` (line 168)
- 5x `as GuestSessionDoc` (lines 187, 205, 209, 230, 248, 273)
- TypeScript compiles cleanly already (`tsc --noEmit` passes)

---

## Assumptions

1. `guest-sessions` is registered in `Config['collections']` in `payload-types.ts` (confirmed at line 77).
2. The generated `GuestSession` type from `payload-types.ts` has all fields that `GuestSessionDoc` defines (confirmed — verified field-by-field match).
3. The `GuestSessionDoc` export is used by callers — we'll keep it as a type alias for backward compatibility.
4. Removing `as const` is safe because Payload's `.create()/.find()/.findByID()/.update()` generics already constrain the `collection` parameter to `keyof Config['collections']`, so the string literal `'guest-sessions'` is inferred correctly without `as const`.

---

### Step 1: Replace `GuestSessionDoc` interface with type alias and remove all casts

**Root Cause**: The service defines its own `GuestSessionDoc` interface (lines 23-35) that duplicates the auto-generated `GuestSession` from `payload-types.ts`. This causes the need for `as GuestSessionDoc` casts on every Payload return value, because the developer didn't trust Payload's return types.

**Files to Touch**:

- `src/server/services/guest-session.ts` (MODIFIED)

**Reproduction Test** (MUST FAIL before fix, PASS after):

- Test location: `tests/unit/server/services/guest-session.test.ts`
- Add this test inside the `'Module does not import getPayload'` describe block (after the existing test):

```typescript
it('should not have manual GuestSessionDoc interface definition (uses generated type)', async () => {
  const fs = await import('fs')
  const sourceCode = fs.readFileSync('./src/server/services/guest-session.ts', 'utf-8')
  // After fix: no hand-written GuestSessionDoc interface
  expect(sourceCode).not.toMatch(/^export interface GuestSessionDoc/m)
  // After fix: no type assertion casts involving GuestSessionDoc
  expect(sourceCode).not.toMatch(/as GuestSessionDoc/)
  expect(sourceCode).not.toMatch(/as unknown as GuestSessionDoc/)
  // After fix: imports GuestSession from payload-types
  expect(sourceCode).toMatch(/import.*GuestSession.*from ['"]@\/payload-types['"]/)
})
```

- **Why it fails before**: The file contains `export interface GuestSessionDoc` and 6 `as GuestSessionDoc` casts
- **Why it passes after**: Interface is replaced with import alias; all casts are removed

**Fix — exact changes**:

1. **Line 16** — Add import after existing `import type { Payload } from 'payload'`:
   ```typescript
   import type { GuestSession } from '@/payload-types'
   ```

2. **Lines 23-35** — Replace the entire `export interface GuestSessionDoc { ... }` block with:
   ```typescript
   export type GuestSessionDoc = GuestSession
   ```
   This preserves backward compatibility for any external callers importing `GuestSessionDoc`.

3. **Line 150** — Remove `as const`:
   ```
   Before: collection: 'guest-sessions' as const,
   After:  collection: 'guest-sessions',
   ```

4. **Line 168** — Remove cast:
   ```
   Before: return { session: session as unknown as GuestSessionDoc, token }
   After:  return { session: session as GuestSessionDoc, token }
   ```
   Note: We keep `as GuestSessionDoc` here because `payload.create()` returns `GuestSession` and our return type is `GuestSessionDoc` (the alias). Actually since `GuestSessionDoc = GuestSession`, we can just do:
   ```
   After:  return { session, token }
   ```
   Wait — the function signature returns `Promise<{ session: GuestSessionDoc; token: string }>`. Since `GuestSessionDoc` is now just `GuestSession`, and `payload.create()` returns `GuestSession`, no cast needed:
   ```
   After:  return { session, token }
   ```

5. **Line 178** — Remove `as const`:
   ```
   Before: collection: 'guest-sessions' as const,
   After:  collection: 'guest-sessions',
   ```

6. **Line 187** — Remove cast:
   ```
   Before: const session = sessions.docs[0] as GuestSessionDoc
   After:  const session = sessions.docs[0]
   ```

7. **Line 201** — Remove `as const`:
   ```
   Before: collection: 'guest-sessions' as const,
   After:  collection: 'guest-sessions',
   ```

8. **Line 205** — Remove cast:
   ```
   Before: if (!session || (session as GuestSessionDoc).status !== 'active') {
   After:  if (!session || session.status !== 'active') {
   ```

9. **Lines 209-210** — Remove intermediate variable:
   ```
   Before:
     const doc = session as GuestSessionDoc
     const hardExpiresAt = new Date(doc.hardExpiresAt)
   After:
     const hardExpiresAt = new Date(session.hardExpiresAt)
   ```
   (Delete line 209 entirely, change `doc.` to `session.` on line 210)

10. **Line 222** — Remove `as const`:
    ```
    Before: collection: 'guest-sessions' as const,
    After:  collection: 'guest-sessions',
    ```

11. **Line 230** — Remove cast:
    ```
    Before: return updated as GuestSessionDoc
    After:  return updated
    ```

12. **Line 239** — Remove `as const`:
    ```
    Before: collection: 'guest-sessions' as const,
    After:  collection: 'guest-sessions',
    ```

13. **Line 248** — Remove cast:
    ```
    Before: return updated as GuestSessionDoc
    After:  return updated
    ```

14. **Line 265** — Remove `as const`:
    ```
    Before: collection: 'guest-sessions' as const,
    After:  collection: 'guest-sessions',
    ```

15. **Lines 273-274** — Remove intermediate variable:
    ```
    Before:
      const doc = session as GuestSessionDoc
      const currentCount = doc.messageCount ?? 0
    After:
      const currentCount = session.messageCount ?? 0
    ```
    (Delete line 273 entirely, change `doc.` to `session.` on line 274)

16. **Line 286** — Remove `as const`:
    ```
    Before: collection: 'guest-sessions' as const,
    After:  collection: 'guest-sessions',
    ```

**Important note for build agent**: After making these changes, if `tsc --noEmit` shows type errors on the return types (e.g., function returns `GuestSessionDoc | null` but Payload returns a different shape), add the `GuestSessionDoc` return type annotation back and use `as GuestSessionDoc` only where truly needed. The goal is to minimize casts, not break compilation.

**Verification**:

- [ ] `pnpm test:unit -- tests/unit/server/services/guest-session.test.ts` — new source-check test passes
- [ ] `pnpm -s tsc --noEmit` — zero type errors
- [ ] `grep -c 'as any' src/server/services/guest-session.ts` returns 0
- [ ] `grep -c 'as unknown' src/server/services/guest-session.ts` returns 0
- [ ] `grep -c 'as GuestSessionDoc' src/server/services/guest-session.ts` returns 0
- [ ] `grep -c 'export interface GuestSessionDoc' src/server/services/guest-session.ts` returns 0
- [ ] `grep -c 'as const' src/server/services/guest-session.ts` returns 0

**Estimated time**: 15 minutes

---

### Step 2: Verify callers and run full quality gates

**Files to Touch**:

- Potentially `src/server/payload/endpoints/cron/guest-sessions-cleanup.ts` (this file has its own `GuestSessionDocument` interface — unrelated, do NOT change it)
- No other files import `GuestSessionDoc` from `guest-session.ts` (verified via grep)

**Test**:

- Test location: Existing tests
- Run: `pnpm test:unit -- tests/unit/server/services/guest-session.test.ts`
- Run: `pnpm test:unit -- tests/unit/server/services/guest-session-upgrade.test.ts`
- These should all pass with no changes (the `GuestSessionDoc` type alias export preserves backward compatibility)

**Verification**:

- [ ] `pnpm -s tsc --noEmit` — zero errors across entire project
- [ ] `pnpm test:unit -- tests/unit/server/services/guest-session.test.ts` — all tests pass
- [ ] `pnpm test:unit -- tests/unit/server/services/guest-session-upgrade.test.ts` — all tests pass
- [ ] No `as any` or `as const` (for collection names) or `as GuestSessionDoc` casts remain

**Estimated time**: 5 minutes

---

## Acceptance Criteria (from spec)

| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-1: `pnpm generate:types` runs without errors | ✅ Already done | `guest-sessions` is in type registry (line 77 of `payload-types.ts`) |
| FR-2: GuestSessions collection properly exported | ✅ Already done | Verified by its presence in generated types |
| FR-3: All `as any` casts removed | ✅ Done in previous run | Changed to `as const`; this plan also removes `as const` |
| TypeScript compilation succeeds | ✅ Currently passes | Must continue to pass after changes |
| GuestSessions collection properly typed | 🔧 This plan | Remove redundant interface + all unnecessary casts |

## Test Commands

```bash
# Run guest-session unit tests (includes new source-check test)
pnpm test:unit -- tests/unit/server/services/guest-session.test.ts

# Run guest-session-upgrade unit tests
pnpm test:unit -- tests/unit/server/services/guest-session-upgrade.test.ts

# Full type check
pnpm -s tsc --noEmit

# Verify no casts remain
grep -c 'as any\|as GuestSessionDoc\|as unknown\|as const' src/server/services/guest-session.ts
# Expected: 0

# Verify import exists
grep 'GuestSession.*payload-types' src/server/services/guest-session.ts
# Expected: 1 match
```
