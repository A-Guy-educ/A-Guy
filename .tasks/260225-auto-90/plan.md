# Plan: Guest Session Type Safety Fix

**Task ID**: 260225-auto-90
**Task Type**: fix_bug
**Spec Requirements**: FR-1, FR-2, FR-3

## Rerun Context

This is a rerun (previous run requested via `/cody rerun` with no specific feedback). Analysis of the current codebase shows:

- **Previous run partially fixed the issue**: The `as any` casts on Payload operations were already converted to `as const` (correct — `as const` is needed for TypeScript literal type inference on collection names).
- **`guest-sessions` IS in the type registry**: `src/payload-types.ts` line 77 already contains `'guest-sessions': GuestSession`.
- **TypeScript already compiles cleanly** (`tsc --noEmit` passes with zero errors).
- **Remaining problem**: The service defines a redundant `GuestSessionDoc` interface (lines 23-35) and uses 6 `as GuestSessionDoc` / `as unknown as GuestSessionDoc` casts throughout the file. These should be replaced with the generated `GuestSession` type from `payload-types.ts`.
- **Plan update**: This plan focuses on removing the custom interface and all unnecessary type casts, replacing with the Payload-generated type.

---

## Assumptions

1. The `as const` on collection string literals is **correct and should remain** — it helps TypeScript infer the literal type `'guest-sessions'` for Payload's generic operations.
2. The generated `GuestSession` type from `payload-types.ts` is the source of truth and should replace the hand-written `GuestSessionDoc`.
3. The `claimedByUser` field difference (`string` in `GuestSessionDoc` vs `(string | null) | User` in generated type) is expected — the generated type accounts for populated relationships.
4. Callers of the service that reference `GuestSessionDoc` need to be updated to use `GuestSession`.

---

## Step 1: Replace `GuestSessionDoc` with generated `GuestSession` type

**Root Cause**: The service defines its own `GuestSessionDoc` interface (lines 23-35) that duplicates the auto-generated `GuestSession` from `payload-types.ts`. This hand-written interface causes the need for `as GuestSessionDoc` casts on every Payload return value, because Payload operations already return `GuestSession`.

**Files to Touch**:

- `src/server/services/guest-session.ts` (MODIFIED — lines 16, 23-35, 131, 168, 171, 187, 196, 205, 209, 230, 233, 248, 258, 273)

**Changes**:

1. Add import: `import type { GuestSession as GuestSessionDoc } from '@/payload-types'` (type alias preserves external API compatibility)
2. Remove the hand-written `GuestSessionDoc` interface (lines 23-35)
3. Remove unnecessary `as unknown as GuestSessionDoc` cast on line 168 — `payload.create()` already returns `GuestSession`
4. Remove unnecessary `as GuestSessionDoc` cast on line 187 — `sessions.docs[0]` is already `GuestSession`
5. Remove unnecessary `(session as GuestSessionDoc).status` cast on line 205 — `session` returned from `payload.findByID()` is already `GuestSession`
6. Remove unnecessary `const doc = session as GuestSessionDoc` on line 209 — use `session` directly
7. Remove unnecessary `as GuestSessionDoc` cast on line 230 — `payload.update()` already returns `GuestSession`
8. Remove unnecessary `as GuestSessionDoc` cast on line 248 — same
9. Remove unnecessary `const doc = session as GuestSessionDoc` on line 273 — use `session` directly

**Reproduction Test** (test that all type casts are removed):

- Test location: `tests/unit/server/services/guest-session.test.ts`
- Add a test in the existing "Module does not import getPayload" describe block:
  ```
  it('should not have manual GuestSessionDoc interface definition', async () => {
    const fs = await import('fs')
    const sourceCode = fs.readFileSync('./src/server/services/guest-session.ts', 'utf-8')
    // After fix: no hand-written GuestSessionDoc interface
    expect(sourceCode).not.toMatch(/export interface GuestSessionDoc/)
    // After fix: no 'as GuestSessionDoc' casts
    expect(sourceCode).not.toMatch(/as GuestSessionDoc/)
    expect(sourceCode).not.toMatch(/as unknown as GuestSessionDoc/)
  })
  ```
- Why it fails before: The file contains `export interface GuestSessionDoc` and 6 `as GuestSessionDoc` casts
- Why it passes after: The interface is removed and replaced with an import alias; all casts removed

**Fix details**:

The import line changes from:
```typescript
import type { Payload } from 'payload'
```
to:
```typescript
import type { Payload } from 'payload'
import type { GuestSession as GuestSessionDoc } from '@/payload-types'
```

The exported `GuestSessionDoc` type alias ensures backward compatibility for any external callers. The interface block (lines 23-35) is deleted entirely.

For each function, the return type annotation stays `GuestSessionDoc` (which now resolves to the generated `GuestSession` type), so no downstream API changes are needed.

Specific cast removals:

| Line | Before | After |
|------|--------|-------|
| 168 | `return { session: session as unknown as GuestSessionDoc, token }` | `return { session, token }` |
| 187 | `const session = sessions.docs[0] as GuestSessionDoc` | `const session = sessions.docs[0]` |
| 205 | `if (!session \|\| (session as GuestSessionDoc).status !== 'active')` | `if (!session \|\| session.status !== 'active')` |
| 209 | `const doc = session as GuestSessionDoc` | Remove line; use `session` directly below |
| 210 | `const hardExpiresAt = new Date(doc.hardExpiresAt)` | `const hardExpiresAt = new Date(session.hardExpiresAt)` |
| 230 | `return updated as GuestSessionDoc` | `return updated` |
| 248 | `return updated as GuestSessionDoc` | `return updated` |
| 273 | `const doc = session as GuestSessionDoc` | Remove line; use `session` directly below |
| 274 | `const currentCount = doc.messageCount ?? 0` | `const currentCount = session.messageCount ?? 0` |

**Note on return types**: The function signatures that return `GuestSessionDoc | null` should be updated to return `GuestSession | null` (since the alias is only for the export, not the internal usage). Alternatively, keep the alias and use it in signatures. The simplest approach: use the alias `GuestSessionDoc` everywhere for minimal diff.

**Verification**:

- [ ] `pnpm test:unit -- tests/unit/server/services/guest-session.test.ts` — all existing tests pass + new source-check test passes
- [ ] `pnpm -s tsc --noEmit` — zero type errors
- [ ] No `as any`, `as unknown as`, or `as GuestSessionDoc` casts in `guest-session.ts`
- [ ] The `GuestSessionDoc` export still exists (as a type alias) for backward compatibility

**Estimated time**: 10-15 minutes

---

## Step 2: Update callers that import `GuestSessionDoc`

**Root Cause**: Other files may import `GuestSessionDoc` from the service. These should continue to work since we export a type alias, but we should verify.

**Files to Touch**:

- Search for all imports of `GuestSessionDoc` across the codebase and verify they still compile

**Reproduction Test**:

- Test location: `tests/unit/server/services/guest-session.test.ts`
- Test: The existing test suite should continue to pass, verifying the public API hasn't changed
- Verification: `pnpm -s tsc --noEmit` passes (full project type-check)

**Changes**:

- If any file imports `GuestSessionDoc` from `@/server/services/guest-session`, it should still work via the type alias
- If any file uses properties only on the old interface but not on the generated type (unlikely based on analysis), add type narrowing

**Verification**:

- [ ] `pnpm -s tsc --noEmit` — zero type errors across entire project
- [ ] `pnpm test:unit -- tests/unit/server/services/guest-session.test.ts` — all tests pass
- [ ] `pnpm test:unit -- tests/unit/server/services/guest-session-upgrade.test.ts` — all tests pass (this file likely uses GuestSessionDoc)

**Estimated time**: 5-10 minutes

---

## Step 3: Final validation — run full quality gates

**Files to Touch**: None (validation only)

**Verification**:

- [ ] `pnpm -s tsc --noEmit` — zero errors
- [ ] `pnpm test:unit` — guest-session tests pass (ignore pre-existing failures in cody CLI tests which are unrelated)
- [ ] `grep -c 'as any' src/server/services/guest-session.ts` returns 0
- [ ] `grep -c 'as GuestSessionDoc' src/server/services/guest-session.ts` returns 0
- [ ] `grep -c 'as unknown' src/server/services/guest-session.ts` returns 0

**Estimated time**: 5 minutes

---

## Acceptance Criteria (from spec)

- [x] FR-1: `pnpm generate:types` already succeeds — `guest-sessions` is in the type registry (line 77 of `payload-types.ts`)
- [x] FR-2: GuestSessions collection is properly exported and included in config (verified by its presence in generated types)
- [ ] FR-3: All `as any` casts removed from `guest-session.ts` — already done in previous run (`as any` → `as const`); this plan removes remaining `as GuestSessionDoc` / `as unknown as GuestSessionDoc` casts
- [ ] TypeScript compilation succeeds without type errors
- [ ] GuestSessions collection is properly typed in Payload operations (no manual casts needed)

## Test Commands

```bash
# Run guest-session unit tests
pnpm test:unit -- tests/unit/server/services/guest-session.test.ts

# Run guest-session-upgrade unit tests  
pnpm test:unit -- tests/unit/server/services/guest-session-upgrade.test.ts

# Full type check
pnpm -s tsc --noEmit

# Verify no casts remain
grep -c 'as any\|as GuestSessionDoc\|as unknown' src/server/services/guest-session.ts
# Expected: 0
```
